export const FASES_CHECKLIST_ORNARE = [
  'Pré-Montagem',
  'Montagem',
  'Pós-Montagem',
  'Supervisor',
  'Entrega',
  'Pós-Venda',
  'Assistência Técnica',
  'Garantia',
]

export const AMBIENTES_CHECKLIST_ORNARE = [
  'Geral',
  'Cozinha',
  'Lavanderia',
  'Sala',
  'Lavabo',
  'Banheiro',
  'Closet',
  'Suíte',
  'Dormitório',
  'Área Gourmet',
  'Living',
  'Home Office',
]

export const CRITICIDADES_CHECKLIST_ORNARE = ['baixa', 'media', 'alta', 'critica']

export const RESPONSAVEIS_CHECKLIST_ORNARE = ['gestao', 'pos_venda', 'supervisor', 'montador']

export const MODELOS_CAMPO_ORNARE = [
  { fase: 'Pré-Montagem', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 10, exige_foto: true, exige_observacao: true, descricao: 'Validar infraestrutura da obra e confirmar se está apta para receber o mobiliário.' },
  { fase: 'Pré-Montagem', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 20, exige_foto: true, descricao: 'Registrar fotos de acesso, carga, descarga, elevador e áreas comuns.' },
  { fase: 'Pré-Montagem', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 30, exige_observacao: true, descricao: 'Confirmar regras do condomínio, horários permitidos e responsável no local.' },
  { fase: 'Pré-Montagem', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 40, exige_foto: true, descricao: 'Conferir energia elétrica disponível, iluminação e condições mínimas para ferramentas.' },
  { fase: 'Pré-Montagem', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 50, exige_foto: true, descricao: 'Conferir proteção de piso, cantoneiras de proteção e área de trabalho desimpedida.' },
  { fase: 'Pré-Montagem', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'media', ordem: 60, exige_observacao: true, descricao: 'Registrar pendências civis aparentes antes da equipe iniciar a montagem.' },
  { fase: 'Pré-Montagem', ambiente: 'Cozinha', responsavel: 'supervisor', criticidade: 'alta', ordem: 70, exige_foto: true, descricao: 'Conferir pontos hidráulicos, elétricos e interferências aparentes da cozinha.' },
  { fase: 'Pré-Montagem', ambiente: 'Área Gourmet', responsavel: 'supervisor', criticidade: 'alta', ordem: 80, exige_foto: true, descricao: 'Conferir bancada, churrasqueira, exaustão, pontos técnicos e interferências da área gourmet.' },
  { fase: 'Pré-Montagem', ambiente: 'Lavanderia', responsavel: 'supervisor', criticidade: 'media', ordem: 90, exige_foto: true, descricao: 'Conferir pontos hidráulicos, elétrica e condições de instalação da lavanderia.' },
  { fase: 'Pré-Montagem', ambiente: 'Banheiro', responsavel: 'supervisor', criticidade: 'media', ordem: 100, exige_foto: true, descricao: 'Conferir prumo, pontos hidráulicos e interferências aparentes dos banheiros e lavabos.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 110, exige_foto: true, descricao: 'Confirmar recebimento dos materiais e volumes conforme romaneio.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 120, exige_foto: true, exige_observacao: true, descricao: 'Registrar avarias de transporte, divergências ou não conformidades antes da execução.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 130, exige_foto: true, descricao: 'Confirmar piso isolado e protegido antes de iniciar a montagem.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 140, exige_foto: true, descricao: 'Confirmar cantoneiras de proteção instaladas em quinas, portas e áreas de passagem.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 150, descricao: 'Seguir a sequência de montagem definida por ambiente e projeto executivo.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 160, descricao: 'Executar fixações estruturais com buchas, parafusos e suportes conforme projeto.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 170, exige_foto: true, descricao: 'Registrar fotos intermediárias de fixação, alinhamento, prumo e ajustes estruturais.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 180, descricao: 'Conferir níveis, alinhamentos verticais e prumos dos módulos.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 190, descricao: 'Testar ferragens, amortecedores, aberturas, dobradiças, portas e gavetas.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 200, exige_foto: true, descricao: 'Registrar fotos detalhadas do processo de desembalagem dos módulos principais.' },
  { fase: 'Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 210, exige_foto: true, descricao: 'Registrar fotos macro dos acabamentos, fechamentos superiores e junções de cantos.' },
  { fase: 'Montagem', ambiente: 'Cozinha', responsavel: 'montador', criticidade: 'alta', ordem: 220, exige_foto: true, descricao: 'Conferir alinhamento, nivelamento, fechamento e ajustes dos módulos da cozinha.' },
  { fase: 'Montagem', ambiente: 'Closet', responsavel: 'montador', criticidade: 'media', ordem: 230, exige_foto: true, descricao: 'Conferir módulos, cabideiros, gavetas, portas e regulagens do closet.' },
  { fase: 'Montagem', ambiente: 'Dormitório', responsavel: 'montador', criticidade: 'media', ordem: 240, exige_foto: true, descricao: 'Conferir módulos, painéis, portas, gavetas e acabamentos dos dormitórios.' },
  { fase: 'Montagem', ambiente: 'Área Gourmet', responsavel: 'montador', criticidade: 'alta', ordem: 250, exige_foto: true, descricao: 'Conferir fixação, nivelamento e integração dos módulos da área gourmet.' },
  { fase: 'Montagem', ambiente: 'Banheiro', responsavel: 'montador', criticidade: 'media', ordem: 260, exige_foto: true, descricao: 'Conferir fixação, alinhamento, recortes e acabamentos dos módulos de banheiro e lavabo.' },
  { fase: 'Pós-Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 270, exige_foto: true, descricao: 'Registrar foto grande angular de cada ambiente totalmente montado, limpo e finalizado.' },
  { fase: 'Pós-Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 280, exige_observacao: true, descricao: 'Registrar toda pendência técnica residual em relatório antes de encerrar a montagem.' },
  { fase: 'Pós-Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 290, descricao: 'Realizar limpeza fina e conferir ausência de riscos, manchas ou danos aparentes.' },
  { fase: 'Pós-Montagem', ambiente: 'Geral', responsavel: 'montador', criticidade: 'media', ordem: 300, descricao: 'Notificar oficialmente o supervisor sobre o término dos trabalhos em campo.' },
  { fase: 'Supervisor', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 310, exige_foto: true, exige_observacao: true, descricao: 'Validar qualidade geral da montagem, acabamento, limpeza e pendências críticas.' },
  { fase: 'Supervisor', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'media', ordem: 320, exige_observacao: true, descricao: 'Registrar pendências por ambiente com responsável, prazo e ação recomendada.' },
  { fase: 'Supervisor', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 330, exige_foto: true, descricao: 'Registrar fotos finais de validação técnica antes da entrega ao cliente.' },
  { fase: 'Entrega', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 340, exige_foto: true, exige_observacao: true, descricao: 'Conferir se todos os ambientes estão limpos, regulados e prontos para apresentação ao cliente.' },
  { fase: 'Entrega', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 350, exige_observacao: true, descricao: 'Registrar aceite, ressalvas ou pendências de entrega identificadas com o cliente.' },
  { fase: 'Pós-Venda', ambiente: 'Geral', responsavel: 'pos_venda', criticidade: 'media', ordem: 360, descricao: 'Realizar contato de acompanhamento após entrega e registrar percepção do cliente.' },
  { fase: 'Pós-Venda', ambiente: 'Geral', responsavel: 'pos_venda', criticidade: 'media', ordem: 370, exige_observacao: true, descricao: 'Registrar solicitações do cliente e encaminhar para assistência técnica quando necessário.' },
  { fase: 'Assistência Técnica', ambiente: 'Geral', responsavel: 'supervisor', criticidade: 'alta', ordem: 380, exige_foto: true, exige_observacao: true, descricao: 'Registrar pendência técnica, causa provável, responsável e ação corretiva recomendada.' },
  { fase: 'Assistência Técnica', ambiente: 'Geral', responsavel: 'montador', criticidade: 'alta', ordem: 390, exige_foto: true, descricao: 'Registrar fotos antes e depois da assistência técnica executada.' },
  { fase: 'Garantia', ambiente: 'Geral', responsavel: 'pos_venda', criticidade: 'media', ordem: 400, exige_observacao: true, descricao: 'Acompanhar retorno do cliente e registrar decisão, prazo e status da solução.' },
]

export const CHECKLIST_MONTAGEM_GERAL = MODELOS_CAMPO_ORNARE
  .filter(modelo => ['Montagem', 'Pós-Montagem'].includes(modelo.fase))
  .filter(modelo => modelo.ambiente === 'Geral')
  .filter(modelo => modelo.responsavel === 'montador')
  .map(modelo => modelo.descricao)
