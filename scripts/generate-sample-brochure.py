from pathlib import Path
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

out = Path(__file__).resolve().parents[1] / 'uploads' / 'brochures' / 'rrpl-housing-group-sample-brochure.pdf'
out.parent.mkdir(parents=True, exist_ok=True)
c = Canvas(str(out), pagesize=A4)
w, h = A4
navy, gold, slate, light = HexColor('#0d2d49'), HexColor('#d6a431'), HexColor('#52657a'), HexColor('#f4f7fa')
c.setFillColor(navy); c.rect(0, h-78*mm, w, 78*mm, stroke=0, fill=1)
c.setFillColor(gold); c.roundRect(18*mm, h-30*mm, 17*mm, 17*mm, 4*mm, stroke=0, fill=1)
c.setFillColor(navy); c.setFont('Helvetica-Bold', 20); c.drawCentredString(26.5*mm, h-24*mm, 'R')
c.setFillColor(gold); c.setFont('Helvetica-Bold', 11); c.drawString(42*mm, h-18*mm, 'RRPL HOUSING GROUP')
c.setFillColor(white); c.setFont('Helvetica-Bold', 28); c.drawString(18*mm, h-47*mm, 'A better place to belong')
c.setFont('Helvetica', 12); c.drawString(18*mm, h-57*mm, 'Premium homes, transparent guidance, and a seamless buying experience.')
c.setFillColor(light); c.roundRect(18*mm, h-120*mm, w-36*mm, 28*mm, 4*mm, stroke=0, fill=1)
c.setFillColor(navy); c.setFont('Helvetica-Bold', 16); c.drawString(25*mm, h-104*mm, 'Homes designed for everyday living')
c.setFillColor(slate); c.setFont('Helvetica', 10.5); c.drawString(25*mm, h-113*mm, 'Explore well-planned 2 BHK and 3 BHK residences with quality finishes and connected living.')
styles = getSampleStyleSheet(); body = ParagraphStyle('body', parent=styles['BodyText'], fontName='Helvetica', fontSize=10, leading=15, textColor=slate)
items = [('Thoughtful layouts', 'Comfortable 2 BHK and 3 BHK homes designed for practical family life.'), ('Transparent process', 'Dedicated sales support from the first visit to booking and documentation.'), ('Connected lifestyle', 'Convenient locations with amenities that complement modern living.')]
y = h-142*mm
for title, text in items:
    c.setFillColor(gold); c.circle(24*mm, y+3*mm, 3*mm, stroke=0, fill=1)
    c.setFillColor(navy); c.setFont('Helvetica-Bold', 12); c.drawString(33*mm, y+4*mm, title)
    p = Paragraph(text, body); p.wrapOn(c, 145*mm, 16*mm); p.drawOn(c, 33*mm, y-8*mm); y -= 30*mm
c.setFillColor(navy); c.rect(0, 0, w, 34*mm, stroke=0, fill=1)
c.setFillColor(white); c.setFont('Helvetica-Bold', 13); c.drawString(18*mm, 21*mm, 'Book a site visit with RRPL Housing Group')
c.setFont('Helvetica', 9.5); c.drawString(18*mm, 13*mm, 'Contact your RRPL sales representative for current availability, price and offers.')
c.setFillColor(gold); c.setFont('Helvetica-Bold', 9); c.drawRightString(w-18*mm, 21*mm, 'INTERNAL SAMPLE BROCHURE')
c.save()
print(out)
