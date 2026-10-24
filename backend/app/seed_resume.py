"""One-time seed of the owner's real portfolio content, taken ONLY from the owner's resume (ashish_resume_update.pdf).
Nothing here is invented: skills, roles, dates, employers, project and education are as written in the resume.
Runs once (marker in site_settings) so later admin edits/deletions are never overwritten. Disable with SEED_RESUME=0."""
import os
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Experience, Profile, Project, Service, SiteSetting, Skill

MARKER = "seed_resume_done"

PROFILE = dict(
    full_name="Ashish Pratap",
    headline="Full Stack Developer building fast, responsive web apps with React, Next.js, Node.js, MongoDB and Python.",
    bio=(
        "I'm a Full Stack Developer with 2+ years of experience building responsive, scalable web applications using React.js, "
        "Next.js, Node.js, MongoDB and Python. I build end-to-end solutions for client and internal projects, from front-end UI "
        "to back-end APIs and database design.\n\n"
        "At DigiQuest Consultancy Services in Gorakhpur I develop and maintain live client and internal applications while also "
        "managing the company's IT operations, so I'm used to working independently and coordinating across teams.\n\n"
        "Before that I interned as a frontend developer at Alobha Technologies in Noida, and I freelanced from 2017 to 2024, "
        "teaching myself web development through freeCodeCamp, Udemy and YouTube while delivering small websites and web apps "
        "for clients.\n\n"
        "I hold a B.Tech in Electronics and Communications Engineering from Buddha Institute of Technology."
    ),
    location="Gorakhpur, Uttar Pradesh, India",
    contact_email="ashish.ashish.pratap25@gmail.com",
    social_links=[{"label": "ashish-pratap.netlify.app", "url": "https://ashish-pratap.netlify.app"}],
)

SKILLS = [
    ("Languages & Frameworks", ["JavaScript", "Python", "HTML5", "CSS3", "React.js", "Next.js", "Redux.js", "Node.js", "Express.js"]),
    ("Database", ["MongoDB"]),
    ("Styling & Tools", ["Tailwind CSS", "Bootstrap", "WordPress", "Git"]),
    ("Other", ["Team Management", "IT Operations Management"]),
]

EXPERIENCE = [
    dict(company="DigiQuest Consultancy Services Pvt. Ltd.", role="Full Stack Developer", location="Gorakhpur, Uttar Pradesh, India",
         start_date=date(2024, 10, 1), end_date=None, description=(
             "• Develop and maintain live client and internal web applications using React.js, Next.js, Node.js, MongoDB, Python, and Tailwind CSS.\n"
             "• Build responsive, high-performance user interfaces and integrate them with backend APIs and databases.\n"
             "• Collaborate across design and development functions to deliver end-to-end product features.")),
    dict(company="DigiQuest Consultancy Services Pvt. Ltd.", role="Web Developer and IT Manager", location="Gorakhpur, Uttar Pradesh, India",
         start_date=date(2024, 10, 1), end_date=None, description=(
             "• Manage IT operations and infrastructure needs for the organization alongside core development work.\n"
             "• Oversee web development projects using Bootstrap and related frameworks, from planning to deployment.\n"
             "• Support team coordination and technical decision-making for ongoing IT initiatives.")),
    dict(company="Alobha Technologies Pvt. Ltd.", role="Internship Trainee, Frontend Developer", location="Noida, Uttar Pradesh, India",
         start_date=date(2024, 3, 1), end_date=date(2024, 9, 30), description=(
             "• Built and styled responsive user interfaces using HTML5, CSS3, JavaScript, and Redux.js.\n"
             "• Gained hands-on experience with modern front-end development workflows and tools.\n"
             "• Contributed to real-time product applications under guidance of senior developers.")),
    # The resume gives years only. Jan 1 / Dec 31 is the convention the site renders as a year-only range ("2017 – 2024").
    dict(company="Self-Employed", role="Freelance Web Developer", location="Remote",
         start_date=date(2017, 1, 1), end_date=date(2024, 12, 31), description=(
             "• Self-taught web development through online platforms including freeCodeCamp, Udemy, and YouTube, covering HTML, CSS, JavaScript, and React.js.\n"
             "• Delivered small-scale websites and web applications for freelance clients, handling requirements gathering, design, and development independently.\n"
             "• Continuously built personal projects to strengthen skills in front-end and full-stack development ahead of transitioning to a full-time role.")),
]

PROJECTS = [
    dict(title="IT Solution Website", slug="it-solution-website",
         summary="A fully responsive website for the IT industry, showcasing services and capabilities.",
         description=("Developed a fully responsive IT solutions website tailored for the IT industry, showcasing services and capabilities.\n\n"
                      "Implemented a modern, mobile-friendly design using React.js and Tailwind CSS."),
         tech=["React.js", "Tailwind CSS"]),
]

# Offerings derived directly from the resume's stated skills (no prices, no new claims). Edit freely in the admin.
SERVICES = [
    dict(title="Responsive websites", description="Fast, mobile-friendly websites built with React.js or Next.js and Tailwind CSS, from planning to deployment."),
    dict(title="Full-stack web applications", description="End-to-end applications: the user interface, backend APIs with Node.js, Express.js or Python, and MongoDB database design."),
    dict(title="WordPress and Bootstrap sites", description="Business websites built with WordPress or Bootstrap, handled from requirements through to launch."),
]

SETTINGS = {
    "site_title": "Ashish Pratap",
    "tagline": "Full Stack Developer | React.js | Next.js | Node.js | MongoDB | Python",
    "footer_text": "© Ashish Pratap. Built with Next.js and FastAPI.",
    "education": "B.Tech, Electronics and Communications Engineering · Buddha Institute of Technology, India",
}


def seed(db: Session) -> bool:
    """Insert the resume content once. Returns True if it seeded."""
    if os.environ.get("SEED_RESUME", "1") == "0" or db.get(SiteSetting, MARKER):
        return False
    profile = db.scalar(select(Profile).limit(1))
    if profile is None:
        profile = Profile(status="published", sort_order=0, **PROFILE)
        db.add(profile)
    elif profile.full_name.startswith("[PLACEHOLDER]"):  # only replace the untouched placeholder profile
        for k, v in PROFILE.items():
            setattr(profile, k, v)
        profile.status = "published"
    order = 0
    for category, names in SKILLS:
        for name in names:
            db.add(Skill(name=name, category=category, status="published", sort_order=order))
            order += 1
    for i, e in enumerate(EXPERIENCE):
        db.add(Experience(status="published", sort_order=i, **e))
    for i, p in enumerate(PROJECTS):
        db.add(Project(status="published", sort_order=i, **p))
    for i, s in enumerate(SERVICES):
        db.add(Service(status="published", sort_order=i, **s))
    for k, v in SETTINGS.items():
        if db.get(SiteSetting, k) is None:
            db.add(SiteSetting(key=k, value=v))
    db.add(SiteSetting(key=MARKER, value="1"))
    db.commit()
    return True
