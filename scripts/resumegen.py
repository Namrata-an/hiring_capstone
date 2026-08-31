from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import zipfile
import os

def create_ocr_optimized_resume(filename, data):
    doc = SimpleDocTemplate(filename, pagesize=letter, topMargin=30, bottomMargin=30, leftMargin=40, rightMargin=40)
    styles = getSampleStyleSheet()
    
    # Custom Styles for OCR Clarity
    name_style = ParagraphStyle('NameStyle', parent=styles['Heading1'], fontSize=16, spaceAfter=2)
    sub_style = ParagraphStyle('SubStyle', parent=styles['Normal'], fontSize=10, leading=12)
    heading_style = ParagraphStyle('HeadingStyle', parent=styles['Heading2'], fontSize=11, spaceBefore=8, spaceAfter=4, fontName='Helvetica-Bold')
    body_style = ParagraphStyle('BodyStyle', parent=styles['Normal'], fontSize=9, leading=11)
    bullet_style = ParagraphStyle('BulletStyle', parent=styles['Normal'], fontSize=9, leading=11, leftIndent=12, firstLineIndent=-12)

    content = []

    # Header
    content.append(Paragraph(f"<b>{data['name']}</b>", name_style))
    content.append(Paragraph(f"{data['role']}", sub_style))
    content.append(Paragraph(f"{data['email']} | {data['phone']} | {data['location']} | {data['links']}", body_style))
    content.append(Spacer(1, 6))

    # Summary
    content.append(Paragraph(data['summary'], body_style))
    content.append(Spacer(1, 4))

    # Education
    content.append(Paragraph("Education", heading_style))
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    for edu in data['education']:
        content.append(Paragraph(f"<b>{edu['inst']}</b>, {edu['loc']}", body_style))
        content.append(Paragraph(f"{edu['degree']} | CGPA: {edu['cgpa']} | {edu['dates']}", body_style))
    content.append(Spacer(1, 4))

    # Skills
    content.append(Paragraph("Skills", heading_style))
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    for cat, val in data['skills'].items():
        content.append(Paragraph(f"<b>{cat}:</b> {val}", body_style))
    content.append(Spacer(1, 4))

    # Work Experience
    content.append(Paragraph("Work Experience", heading_style))
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    for exp in data['experience']:
        content.append(Paragraph(f"<b>{exp['title']}</b> | {exp['company']}, {exp['loc']}", body_style))
        content.append(Paragraph(f"<i>{exp['dates']}</i>", body_style))
        for b in exp['bullets']:
            content.append(Paragraph(f"• {b}", bullet_style))
        content.append(Spacer(1, 4))

    # Projects
    content.append(Paragraph("Projects", heading_style))
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.black))
    for proj in data['projects']:
        content.append(Paragraph(f"<b>{proj['title']}</b> | {proj['tech']}", body_style))
        for b in proj['bullets']:
            content.append(Paragraph(f"• {b}", bullet_style))
        content.append(Spacer(1, 4))

    doc.build(content)

# Data Generation for 20 unique resumes
names = [
    "Aditya Sharma", "Ishani Iyer", "Rohan Verma", "Kavya Reddy", "Siddharth Nair", 
    "Meera Joshi", "Arjun Malhotra", "Ananya Das", "Varun Gupta", "Priyanka Rao",
    "Rahul Saxena", "Sneha Kulkarni", "Tanmay Bhat", "Riya Sen", "Akash Mishra",
    "Divya Menon", "Kartik Pillai", "Zoya Khan", "Manish Pandey", "Sanya Hegde"
]

companies = [
    "NVIDIA", "Microsoft Research", "Tesla Autopilot", "Adobe Systems", "Swiggy AI Labs",
    "Razorpay", "Ola Electric", "Freshworks", "Cisco Systems", "Intel Corporation",
    "J.P. Morgan AI", "Google DeepMind", "Amazon Web Services", "Samsung Research", "Flipkart",
    "Zomato Tech", "Atlassian", "Oracle Cloud", "IBM Watson", "Paytm"
]

resumes_data = []
for i in range(20):
    resumes_data.append({
        "name": names[i],
        "role": "Software Engineering Fellow / AI Researcher",
        "email": f"{names[i].lower().replace(' ', '.')}@gmail.com",
        "phone": f"+91 9{i}876543{i}1",
        "location": "Bengaluru, Karnataka, India",
        "links": f"github.com/{names[i].lower().replace(' ', '')} | portfolio.ai",
        "summary": "Final-year student specializing in high-performance systems and machine learning. Experienced in architecting scalable solutions for complex engineering problems.",
        "education": [{"degree": "Bachelor of Technology in Artificial Intelligence", "inst": "Amrita Vishwa Vidyapeetham", "loc": "Bengaluru", "cgpa": f"8.{i+10}", "dates": "2022 - 2026"}],
        "skills": {
            "Programming": "Python, C++, TypeScript, Rust, SQL",
            "AI & ML": "PyTorch, TensorFlow, LangChain, Transformers, RLlib",
            "Cloud/DevOps": "AWS (EC2, S3), Docker, Kubernetes, Terraform, GitHub Actions"
        },
        "experience": [{
            "title": "Machine Learning Intern",
            "company": companies[i],
            "loc": "Hybrid / Bengaluru",
            "dates": "June 2024 - August 2024",
            "bullets": [
                f"Developed a {['latency-optimized', 'distributed', 'quantized'][i%3]} pipeline for real-time inference.",
                "Reduced processing time by 25% using asynchronous sub-task scheduling.",
                "Authored technical documentation for microservice orchestration."
            ]
        }],
        "projects": [{
            "title": f"{['Logistics', 'Robotics', 'NLP', 'Cyber'][i%4]} Optimization Engine",
            "tech": "Python, Docker, AWS, PyTorch",
            "bullets": [
                "Architected a distributed solver using hybrid optimization techniques.",
                "Achieved 20% higher throughput under volatile network constraints.",
                "Implemented fault-tolerant orchestration via Minikube and Grafana."
            ]
        }]
    })

# Final Generation
filenames = []
for data in resumes_data:
    fname = f"Resume_{data['name'].replace(' ', '_')}.pdf"
    create_ocr_optimized_resume(fname, data)
    filenames.append(fname)

zip_filename = "OCR_Test_Resumes_Krithin_Style.zip"
with zipfile.ZipFile(zip_filename, 'w') as zipf:
    for f in filenames:
        zipf.write(f)
        os.remove(f)

print(zip_filename)