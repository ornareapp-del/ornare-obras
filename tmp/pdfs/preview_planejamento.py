from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak

OUT = 'output/pdf/planejamento-executivo-ornare-julho-2026-preview.pdf'
INK = colors.HexColor('#1D1C19'); GOLD = colors.HexColor('#B8965E'); SOFT = colors.HexColor('#F6F3EE'); RED = colors.HexColor('#B84040'); GREEN = colors.HexColor('#2D7A4A')
styles = getSampleStyleSheet(); styles['BodyText'].fontName = 'Helvetica'; styles['BodyText'].fontSize = 7; styles['BodyText'].leading = 9

def header_footer(canvas, doc):
    canvas.saveState(); w, h = landscape(A4)
    canvas.setFillColor(INK); canvas.rect(0, h-29*mm, w, 29*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white); canvas.setFont('Helvetica-Bold', 17); canvas.drawString(14*mm, h-13*mm, 'ORNARE')
    canvas.setFillColor(GOLD); canvas.setFont('Helvetica-Bold', 6.5); canvas.drawString(14*mm, h-19*mm, 'WORKS  /  FLORIANOPOLIS')
    canvas.setFillColor(colors.white); canvas.setFont('Helvetica-Bold', 14); canvas.drawString(78*mm, h-12.5*mm, 'PLANEJAMENTO EXECUTIVO')
    canvas.setFillColor(colors.HexColor('#DDD5C9')); canvas.setFont('Helvetica', 8); canvas.drawString(78*mm, h-19*mm, 'Carteira de obras e agenda operacional  -  julho de 2026')
    canvas.setStrokeColor(GOLD); canvas.line(14*mm, h-26*mm, w-14*mm, h-26*mm)
    canvas.setStrokeColor(colors.HexColor('#E7E0D5')); canvas.line(14*mm, 11*mm, w-14*mm, 11*mm)
    canvas.setFillColor(colors.HexColor('#6D675E')); canvas.setFont('Helvetica', 6.5); canvas.drawString(14*mm, 6*mm, 'PREVIA VISUAL  |  Ornare Works'); canvas.drawRightString(w-14*mm, 6*mm, f'Pagina {doc.page}')
    canvas.restoreState()

def section(text, note=''):
    data=[[Paragraph(f'<b>{text}</b>', styles['BodyText']), Paragraph(note, styles['BodyText'])]]
    t=Table(data,colWidths=[190*mm,79*mm],rowHeights=9*mm); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),SOFT),('LINEBEFORE',(0,0),(0,0),2,GOLD),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),6),('ALIGN',(1,0),(1,0),'RIGHT')]))
    return t

def table(headers, rows, widths):
    data=[[Paragraph(f'<b>{h}</b>', styles['BodyText']) for h in headers]]+[[Paragraph(str(v), styles['BodyText']) for v in row] for row in rows]
    t=Table(data,colWidths=[w*mm for w in widths],repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),INK),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),.25,colors.HexColor('#D9D2C8')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,SOFT]),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    return t

doc=SimpleDocTemplate(OUT,pagesize=landscape(A4),leftMargin=14*mm,rightMargin=14*mm,topMargin=36*mm,bottomMargin=15*mm)
story=[]
story += [Paragraph('<font size="17"><b>Dashboard da operacao</b></font><br/><font color="#6D675E">Leitura executiva da carteira, dos riscos e da mobilizacao das equipes.</font>', styles['BodyText']), Spacer(1,5*mm)]
kpis=Table([['OBRAS ATIVAS','EXECUCOES / AGENDA','EQUIPES MOBILIZADAS','OBRAS TRAVADAS','RISCO ALTO'],['5','6','2','1','1']],colWidths=[53.8*mm]*5,rowHeights=[7*mm,12*mm]); kpis.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,colors.HexColor('#E7E0D5')),('INNERGRID',(0,0),(-1,-1),1,colors.white),('TEXTCOLOR',(0,0),(-1,0),GOLD),('FONT',(0,0),(-1,0),'Helvetica-Bold',6.5),('FONT',(0,1),(-1,1),'Helvetica-Bold',15),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7)])); story += [kpis,Spacer(1,6*mm),section('Visao rapida por obra','5 obras no cronograma'),Spacer(1,2*mm)]
rows=[['Hotel Hilton','Pausada','Montagem','25%','01/09 - 03/09','Equipe tecnica','Obra travada | ocorrencia aberta'],['Marcelo S. Loggemann','Em montagem','Montagem','35%','01/07 - 17/07','Thomas / equipe','1 ocorrencia aberta'],['Gustavo Kuerten','Aguardando inicio','Entrega dos Moveis','20%','20/07 - 31/07','Thomas / montadores','OK - sem pendencias criticas'],['Marco A. Puerta','Em emissao tecnica','Producao','0%','05/08 - 29/09','Equipe nao alocada','Checklist pendente'],['Deived P. Pegoraro','Em producao','Entrega dos Moveis','25%','10/08 - 22/08','Equipe tecnica','OK - sem pendencias criticas']]
story += [table(['OBRA / CLIENTE','STATUS','FASE ATUAL','PROG.','PERIODO PREVISTO','RESPONSAVEL / EQUIPE','ALERTAS'],rows,[52,31,37,16,43,44,46]),Spacer(1,6*mm),section('Agenda operacional do mes','Periodos de execucao e compromissos confirmados'),Spacer(1,2*mm)]
agenda=[['01/07  08:00','Marcelo S. Loggemann','Montagem','01/07 - 17/07','Thomas Altenhofen','Equipe de montagem'],['20/07  08:00','Gustavo Kuerten','Montagem','20/07 - 31/07','Thomas Altenhofen','Equipe alocada'],['25/07  08:00','Gustavo Kuerten','Montagem - sabado','08:00 - 12:00','Thomas Altenhofen','Equipe alocada']]
story += [table(['DATA / HORARIO','OBRA','ATIVIDADE','PERIODO','RESPONSAVEL','EQUIPE ALOCADA'],agenda,[38,54,43,42,43,49]),PageBreak(),section('Dados de cliente e local da obra','Apoio para logistica e contato'),Spacer(1,2*mm)]
clients=[['Hotel Hilton - HK9 Empreend.','(47) 3881-3684','Rua 284, 786 - Meia Praia, Itapema/SC','FAB230058202/03/04','03/09/2026'],['Marcelo Silva Loggemann','(11) 99493-9095 | leticia.silva@ornare.com.br','R. Comendador Caminha, 88 - Porto Alegre/RS','LV2240064204/06','28/08/2026'],['Gustavo Kuerten','(48) 9167-6132','Av. Gov. Irineu Bornhausen, 3600 - Florianopolis/SC','LV2230054006','31/07/2026']]
story += [table(['OBRA / CLIENTE','CONTATO','ENDERECO DA OBRA','CONTRATO','PREVISAO'],clients,[58,58,89,34,30]),Spacer(1,7*mm),section('Pontos de atencao','Prioridades para a reuniao de planejamento'),Spacer(1,2*mm)]
attention=[['Hotel Hilton','Alto | Pausada','Obra travada | ocorrencia aberta','Definir liberacao e nova data'],['Marco A. Puerta','Medio | Em emissao','Equipe nao alocada | checklist pendente','Alocar equipe e concluir checklist']]
story += [table(['OBRA','RISCO / STATUS','PENDENCIA','ACAO RECOMENDADA'],attention,[58,51,91,69])]
doc.build(story,onFirstPage=header_footer,onLaterPages=header_footer)
