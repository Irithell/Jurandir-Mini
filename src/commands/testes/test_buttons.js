export const aliases = ['tb', 'testbuttons', 'testebotoes', 'testbotoes'];
export const description = 'Bateria completa de testes de mensagens interativas e botoes';

const SAMPLE_IMAGE_URL =
  'https://pub-5cd6924d31ff4d3aae9f8df4b3ae81f4.r2.dev/2148dfa454e3a3dcb91d31678e0d639d';
const SAMPLE_DOC_URL =
  'https://pub-5cd6924d31ff4d3aae9f8df4b3ae81f4.r2.dev/bf77c174ada8fa1cad2dcc17e9fc4f17';

/**
 * @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext
 * @typedef {{ phone?: string }} TestSampleData
 * @typedef {(ctx: CommandContext, sampleData?: TestSampleData) => Promise<any>} TestRunner
 * @typedef {{ name: string, run: TestRunner }} TestSuite
 */

/**
 * @param {string} name
 * @param {TestRunner} run
 * @returns {TestSuite}
 */
const defineTest = (name, run) => ({ name, run });

/** @type {Record<number, TestSuite>} */
const testSuites = {
  1: defineTest('Legacy Com Capa / Thumbnail', async (ctx) => {
    const { jurandir, from, info, prefix, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      legacy: true,
      cards: [
        {
          header: {
            title: 'JURANDIR BOT',
            subtitle: 'SEJA BEM-VINDO',
            mediaUrl: SAMPLE_IMAGE_URL,
            mediaType: 'image',
          },
          body: 'Teste 1: Legacy com Capa / Thumbnail',
          footer: 'Jurandir Mini',
          buttons: [
            { type: 'reply', id: `${prefix}menu`, text: 'MENU' },
            { type: 'reply', id: `${prefix}ping`, text: 'PING' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  2: defineTest('Legacy Sem Capa', async (ctx) => {
    const { jurandir, from, info, prefix, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      legacy: true,
      cards: [
        {
          body: 'Teste 2: Legacy Sem Capa',
          footer: 'Jurandir Mini',
          buttons: [
            { type: 'reply', id: `${prefix}menu`, text: 'MENU PRINCIPAL' },
            { type: 'reply', id: `${prefix}ping`, text: 'STATUS BOT' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  3: defineTest('Quick Reply (Resposta Rapida)', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'BOTOES NATIVOS' },
          body: 'Teste 3: Resposta Rapida (Quick Reply)',
          footer: 'Selecione uma opcao',
          buttons: [
            { type: 'reply', id: 'btn_opcao1', text: 'Opcao 1' },
            { type: 'reply', id: 'btn_opcao2', text: 'Opcao 2' },
            { type: 'reply', id: 'btn_opcao3', text: 'Opcao 3' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  4: defineTest('CTA URL & Webview', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'BOTAO CTA URL & WEBVIEW' },
          body: 'Teste 4: Clique abaixo para abrir o link ou webview',
          footer: 'Navegacao Web',
          buttons: [
            { type: 'url', text: 'Abrir GitHub', url: 'https://github.com' },
            {
              type: 'webview',
              text: 'Abrir Webview In-App',
              url: 'https://google.com',
              title: 'Google Search',
              inAppWebview: true,
              fullScreen: true,
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  5: defineTest('CTA Copy', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'BOTAO CTA COPY' },
          body: 'Teste 5: Clique abaixo para copiar o cupom/codigo',
          footer: 'Copiar',
          buttons: [
            {
              type: 'copy',
              text: 'Copiar Cupom',
              payload: 'DESCONTO-2026',
              id: 'copy_btn_1',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  6: defineTest('CTA Call', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'BOTAO CTA CALL' },
          body: 'Teste 6: Clique para iniciar uma chamada de voz',
          footer: 'Suporte',
          buttons: [
            { type: 'call', text: 'Ligar para Suporte', phone: '190' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  7: defineTest('CTA Catalog', async (ctx, sampleData) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    const phone = sampleData?.phone || '';
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'BOTAO CTA CATALOG' },
          body: 'Teste 7: Clique para abrir o catalogo comercial',
          footer: 'Catalogo Oficial',
          buttons: [
            { type: 'catalog', text: 'Ver Catalogo', phone },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  8: defineTest('Single Select List', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'MENU DE SELECAO UNICA' },
          body: 'Teste 8: Abra a lista interativa para escolher uma opcao',
          footer: 'Selecao por Secoes',
          buttons: [
            {
              type: 'list',
              text: 'Abrir Menu',
              sections: [
                {
                  title: 'Categorias Principais',
                  highlight_label: 'NOVO',
                  rows: [
                    { id: 'item_1', title: 'Opcao 1', description: 'Descricao da opcao 1' },
                    { id: 'item_2', title: 'Opcao 2', description: 'Descricao da opcao 2' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  9: defineTest('PIX Dinamico (review_and_pay)', async (ctx, sampleData) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    const phone = sampleData?.phone || '';
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'PIX DINAMICO' },
          body: 'Teste 9: Checkout PIX Dinamico com codigo Copia e Cola',
          footer: 'Checkout Seguro',
          buttons: [
            {
              type: 'pix',
              text: 'Pagar PIX R$ 25,50',
              amount: 25.5,
              referenceId: 'REF-DINAMICO-123',
              pixCode:
                '00020126360014BR.GOV.BCB.PIX0114+5516989137935520400005303986540525.505802BR5915JURANDIR BOT6009SAO PAULO62070503***6304E21A',
              merchantName: 'Jurandir Bot Ltda',
              pixKey: phone,
              keyType: 'PHONE',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  10: defineTest('PIX Estatico / Chave (payment_info)', async (ctx, sampleData) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    const phone = sampleData?.phone || '';
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'CHAVE PIX ESTATICA' },
          body: 'Teste 10: Pagamento PIX Estatico via Chave cadastrada',
          footer: 'Informacoes de Pagamento',
          buttons: [
            {
              type: 'pix_static',
              text: 'Ver Dados PIX',
              amount: 50.0,
              referenceId: 'REF-ESTATICO-456',
              itemName: 'Assinatura Premium VIP',
              merchantName: 'Jurandir Bot Ltda',
              pixKey: phone,
              keyType: 'PHONE',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  11: defineTest('Boleto Bancario', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'BOLETO BANCARIO' },
          body: 'Teste 11: Linha Digitavel de Boleto para Pagamento',
          footer: 'Boleto Digital',
          buttons: [
            {
              type: 'boleto',
              text: 'Pagar Boleto',
              amount: 120.0,
              referenceId: 'REF-BOLETO-789',
              digitableLine: '34191.09008 61713.927306 01416.010008 1 95000000012000',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  12: defineTest('Link de Pagamento', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'LINK DE PAGAMENTO' },
          body: 'Teste 12: Redirecionamento para gateway de pagamento seguro',
          footer: 'Pagamento Online',
          buttons: [
            {
              type: 'payment_link',
              text: 'Pagar no Site',
              amount: 75.0,
              referenceId: 'REF-LINK-999',
              uri: 'https://checkout.exemplo.com/pay/ref-999',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  13: defineTest('Cartao Offsite & Detalhes da Transacao', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'PAGAMENTOS E TRANSACAO' },
          body: 'Teste 13: Pagamento por cartao offsite e detalhes de transacao',
          footer: 'Jurandir Pay',
          buttons: [
            {
              type: 'card_pay',
              text: 'Pagar com Cartao',
              referenceId: 'TRANS_987654',
              amount: 15.5,
              lastFourDigits: '4321',
              credentialId: 'cred_sample_id',
            },
            {
              type: 'transaction_details',
              text: 'Consultar Transacao',
              transactionId: 'tx_1234567890',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  14: defineTest('Documento Anexo com Botao', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: {
            title: 'DOCUMENTO COM BOTOES',
            subtitle: 'ANEXO',
            mediaUrl: SAMPLE_DOC_URL,
            mediaType: 'document',
            fileName: 'Relatorio.js',
            mimetype: 'application/javascript',
          },
          body: 'Teste 14: Mensagem interativa contendo documento anexo',
          footer: 'Jurandir Mini',
          buttons: [
            { type: 'reply', id: 'doc_confirm', text: 'CONFIRMAR RECEBIMENTO' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  15: defineTest('Carrossel com Imagens', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      asCarousel: true,
      bodyText: 'Carrossel Interativo Jurandir Bot',
      cards: [
        {
          header: {
            title: 'Card 1 - Produto A',
            mediaUrl: SAMPLE_IMAGE_URL,
            mediaType: 'image',
          },
          body: 'Primeiro Card do Carrossel',
          footer: 'Pagina 1 de 2',
          buttons: [
            { type: 'reply', id: 'c1_btn', text: 'Escolher Produto A' },
          ],
        },
        {
          header: {
            title: 'Card 2 - Produto B',
            mediaUrl: SAMPLE_IMAGE_URL,
            mediaType: 'image',
          },
          body: 'Segundo Card do Carrossel',
          footer: 'Pagina 2 de 2',
          buttons: [
            { type: 'reply', id: 'c2_btn', text: 'Escolher Produto B' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  16: defineTest('MPM (Catalogo Multi-Produto)', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'CATALOGO MULTI-PRODUTO (MPM)' },
          body: 'Teste 16: Botao MPM para exibicao de lista de produtos',
          footer: 'Jurandir Store',
          buttons: [
            {
              type: 'mpm',
              title: 'Ver Produtos',
              sections: [
                {
                  title: 'Destaques',
                  rows: [
                    { id: 'prod_01', title: 'Camiseta Jurandir', description: 'R$ 49,90' },
                    { id: 'prod_02', title: 'Caneca Jurandir', description: 'R$ 29,90' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  17: defineTest('Catalogo Comercial & Produto Unico', async (ctx, sampleData) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    const phone = sampleData?.phone || '';
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'CATALOGO BUSINESS' },
          body: 'Teste 17: Botoes nativos de catalogo comercial e produto unico',
          footer: 'WhatsApp Business',
          buttons: [
            {
              type: 'catalog_message',
              text: 'Ver Catalogo Completo',
              businessPhoneNumber: phone,
            },
            {
              type: 'view_catalog',
              text: 'Ver Produto em Destaque',
              businessPhoneNumber: phone,
              catalogProductId: 'prod_12345',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  18: defineTest('Galaxy Flow & Bottom Sheet', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      messageParams: {
        bottomSheet: {
          inThreadButtonsLimit: 1,
          dividerIndices: [1, 2],
          listTitle: '⋆ ᴍᴇɴᴜ ⋆',
          buttonTitle: ' ᴍᴇɴᴜ ',
        },
      },
      cards: [
        {
          header: { title: '⋆ ᴍᴇɴᴜ ᴛᴇsᴛᴇ ⋆' },
          body: 'Teste 18: Galaxy Flow Message Navigation com Bottom Sheet',
          footer: '🐱 Jurandir Bot 2.0',
          buttons: [
            {
              type: 'galaxy',
              flowCta: 'TODOS',
              flowAction: 'navigate',
              flowMessageVersion: '3',
              flowScreen: 'SATISFACTION_SCREEN',
            },
            {
              type: 'list',
              text: 'ᴄᴏᴍᴀɴᴅᴏs',
              sections: [
                {
                  title: 'ᴇxᴇᴍᴘʟᴏs',
                  highlight_label: '2 comandos',
                  rows: [
                    { id: '.ping', title: 'Ping', description: 'Ver latência' },
                    { id: '.menu', title: 'Menu', description: 'Abrir menu' },
                  ],
                },
              ],
            },
            {
              type: 'galaxy',
              flowCta: '🐱 Jurandir Bot',
              flowAction: 'navigate',
              flowMessageVersion: '3',
              flowScreen: 'SATISFACTION_SCREEN',
            },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),

  19: defineTest('Envio de Localizacao', async (ctx) => {
    const { jurandir, from, info, utils: { sendButton } } = ctx;
    return await sendButton(jurandir, from, {
      cards: [
        {
          header: { title: 'LOCALIZACAO' },
          body: 'Teste 19: Botao de envio de localizacao',
          footer: 'Localizacao',
          buttons: [
            { type: 'location', text: 'Enviar Minha Localizacao' },
            { type: 'reply', id: 'loc_cancel', text: 'Cancelar' },
          ],
        },
      ],
      quotedMessage: info,
    });
  }),
};

/**
 * @param {CommandContext} context
 */
export default async (context) => {
  const {
    jurandir,
    from,
    info,
    args,
    prefix,
    userJid,
    utils: { reply, toUnicodeBoldUpper, isOwner },
    sleep,
  } = context;

  if (!isOwner(userJid)) {
    return await reply(
      jurandir,
      from,
      toUnicodeBoldUpper('Apenas o dono do bot pode executar os testes de botoes.'),
      info
    );
  }

  const rawArg = (args && args[0] ? args[0] : '').toLowerCase().trim();
  const phone = userJid.split('@')[0];

  if (!rawArg) {
    const lines = Object.entries(testSuites).map(([id, t]) => {
      return `  [${id.padStart(2, ' ')}] - ${t.name}`;
    });

    const menuHelp = `TESTES DE BOTOES\n\nUso:\n  ${prefix}tb       - Lista todos os testes (nao executa)\n  ${prefix}tb <id>  - Executa um teste especifico (ex: ${prefix}tb 1)\n  ${prefix}tb 0     - Executa todos os testes em lote\n\nTestes Disponiveis:\n${lines.join('\n')}`;

    return await reply(jurandir, from, menuHelp, info);
  }

  if (rawArg === '0' || rawArg === 'all' || rawArg === 'lote' || rawArg === 'full') {
    await reply(
      jurandir,
      from,
      toUnicodeBoldUpper('Iniciando bateria completa de testes (1 a 19)...'),
      info
    );

    const testKeys = Object.keys(testSuites).map(Number).sort((a, b) => a - b);
    let successCount = 0;
    let failCount = 0;

    for (const testId of testKeys) {
      const suite = testSuites[testId];
      if (!suite) continue;
      try {
        await suite.run(context, { phone });
        successCount++;
      } catch (err) {
        failCount++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        await reply(
          jurandir,
          from,
          `[Teste ${testId} - ${suite.name}] Falhou: ${errorMsg}`,
          info
        );
      }
      if (sleep) await sleep(1200);
    }

    return await reply(
      jurandir,
      from,
      toUnicodeBoldUpper(
        `Bateria concluida: ${successCount} sucessos, ${failCount} falhas de ${testKeys.length} testes.`
      ),
      info
    );
  }

  const testId = parseInt(rawArg, 10);
  const suite = testSuites[testId];

  if (!suite) {
    return await reply(
      jurandir,
      from,
      `Subcomando ou ID de teste '${rawArg}' invalido.\nUse '${prefix}tb' para visualizar a lista completa de testes.`,
      info
    );
  }

  try {
    await suite.run(context, { phone });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await reply(
      jurandir,
      from,
      `Falha no Teste ${testId} (${suite.name}): ${errorMsg}`,
      info
    );
  }
};
