const URL_API = 'https://script.google.com/macros/s/AKfycbwqSpqWQOjFcOfSClEGTesKZAGPnuMaKQiIIu9RYChC5yFX6gwXpwFg1f5DpvbNHy5j/exec';
const parametrosUrl = new URLSearchParams(window.location.search);

window.PARAM_EMAIL_GUARDA = parametrosUrl.get('email') || '';
window.PARAM_CODIGO_GUARDA = parametrosUrl.get('codigo') || '';
window.PARAM_PERFIL = parametrosUrl.get('perfil') || '';

async function chamarApi(acao, dados = {}) {
  let resposta;

  try {
    resposta = await fetch(URL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        acao: acao,
        dados: dados
      })
    });
  } catch (erro) {
    throw new Error('Não foi possível conectar ao servidor. Verifique a internet e tente novamente.');
  }

  if (!resposta.ok) {
    throw new Error('Falha de comunicação com o servidor.');
  }

  const resultado = await resposta.json();

  if (!resultado.sucesso) {
    throw new Error(resultado.mensagem || 'Erro ao executar a ação.');
  }

  return resultado.resposta;
}

function obterSessaoTokenLocal() {
  return localStorage.getItem('guarda_sessao_token') || '';
}

function obterSessaoTokenComandanteLocal() {
  return localStorage.getItem('comandante_sessao_token') || '';
}

function obterSessaoTokenToqueLocal() {
  return localStorage.getItem('toque_fogo_sessao_token') || '';
}

function montarDadosChamadaApi(nome, argumentos) {
  const sessaoToken = obterSessaoTokenLocal();
  const sessaoComandanteToken = obterSessaoTokenComandanteLocal();
  const sessaoToqueToken = obterSessaoTokenToqueLocal();

  switch (nome) {
    case 'getListasFormulario':
      return {};
    case 'getGuardaAtivo':
      return { sessaoToken: sessaoToken };
    case 'getComandanteAtivo':
      return { sessaoToken: sessaoComandanteToken };
    case 'getStatusToqueFogo':
      return { sessaoToken: sessaoToqueToken };
    case 'getPainelComandante':
      return { sessaoToken: sessaoComandanteToken };
    case 'getPessoasDentroGuarda':
      return { sessaoToken: sessaoToken, sessaoToqueToken: sessaoToqueToken };
    case 'registrarSaidaRapidaPessoa':
      return { idMovimentacaoEntrada: argumentos[0], sessaoToken: sessaoToken, sessaoToqueToken: sessaoToqueToken };
    case 'getDadosSOS':
      return { sessaoToken: sessaoToken, sessaoToqueToken: sessaoToqueToken };
    case 'registrarMovimentacaoSOS':
      return { sos: argumentos[0], sessaoToken: sessaoToken, sessaoToqueToken: sessaoToqueToken };
    case 'buscarPessoasPorRgCpf':
      return { rgCpf: argumentos[0], sessaoToken: sessaoToken, sessaoToqueToken: sessaoToqueToken };
    case 'registrarMovimentacao':
      return { movimentacao: argumentos[0], sessaoToken: sessaoToken, sessaoToqueToken: sessaoToqueToken };
    case 'enviarCodigoAssumirToqueFogo':
      return { email: argumentos[0] };
    case 'validarCodigoAssumirToqueFogo':
      return { email: argumentos[0], codigo: argumentos[1] };
    case 'assumirToqueFogoComEmailValidado':
      return argumentos[0] || {};
    case 'retomarPostoAposSOS':
      return { sessaoToken: sessaoToken };
    case 'enviarCodigoAssumirGuarda':
      return { email: argumentos[0] };
    case 'validarCodigoAssumirGuarda':
      return { email: argumentos[0], codigo: argumentos[1] };
    case 'assumirGuardaComEmailValidado':
      return argumentos[0] || {};
    case 'enviarCodigoEncerrarGuarda':
      return { sessaoToken: sessaoToken };
    case 'validarCodigoEEncerrarGuarda':
      return {
        email: argumentos[0],
        codigo: argumentos[1],
        sessaoToken: sessaoToken
      };
    case 'enviarCodigoAssumirComandante':
      return { email: argumentos[0] };
    case 'validarCodigoAssumirComandante':
      return { email: argumentos[0], codigo: argumentos[1] };
    case 'assumirComandanteComEmailValidado':
      return argumentos[0] || {};
    case 'enviarCodigoEncerrarComandante':
      return { sessaoToken: sessaoComandanteToken };
    case 'validarCodigoEEncerrarComandante':
      return {
        email: argumentos[0],
        codigo: argumentos[1],
        sessaoToken: sessaoComandanteToken
      };
    default:
      return argumentos[0] || {};
  }
}

function ajustarRespostaApi(nome, resposta) {
  if (nome === 'getGuardaAtivo') {
    const guarda = resposta && resposta.guarda ? resposta.guarda : null;

    if (guarda) {
      guarda.Sessao_Valida = resposta.sessaoValida === true;
    }

    return guarda;
  }

  if (nome === 'getComandanteAtivo') {
    const comandante = resposta && resposta.comandante ? resposta.comandante : null;

    if (comandante) {
      comandante.Sessao_Valida = resposta.sessaoValida === true;
    }

    return comandante;
  }

  if (nome === 'getStatusToqueFogo') {
    const status = resposta || {};
    if (status.toque) status.toque.Sessao_Valida = status.sessaoValida === true;
    return status;
  }

  if (
    nome === 'assumirGuardaComEmailValidado' &&
    resposta &&
    resposta.guarda &&
    resposta.sessaoToken
  ) {
    resposta.guarda.Sessao_Valida = true;
    resposta.guarda.Sessao_Token = resposta.sessaoToken;
  }

  if (
    nome === 'assumirComandanteComEmailValidado' &&
    resposta &&
    resposta.comandante &&
    resposta.sessaoToken
  ) {
    resposta.comandante.Sessao_Valida = true;
    resposta.comandante.Sessao_Token = resposta.sessaoToken;
  }

  if (
    nome === 'assumirToqueFogoComEmailValidado' &&
    resposta && resposta.toque && resposta.sessaoToken
  ) {
    resposta.toque.Sessao_Valida = true;
    resposta.toque.Sessao_Token = resposta.sessaoToken;
  }

  return resposta;
}

function criarExecutorAppsScript() {
  let sucesso = () => {};
  let falha = () => {};

  const executor = {
    withSuccessHandler(callback) {
      sucesso = typeof callback === 'function' ? callback : sucesso;
      return executor;
    },
    withFailureHandler(callback) {
      falha = typeof callback === 'function' ? callback : falha;
      return executor;
    }
  };

  [
    'getListasFormulario',
    'getGuardaAtivo',
    'getComandanteAtivo',
    'getStatusToqueFogo',
    'getPainelComandante',
    'getPessoasDentroGuarda',
    'registrarSaidaRapidaPessoa',
    'getDadosSOS',
    'registrarMovimentacaoSOS',
    'buscarPessoasPorRgCpf',
    'registrarMovimentacao',
    'enviarCodigoAssumirToqueFogo',
    'validarCodigoAssumirToqueFogo',
    'assumirToqueFogoComEmailValidado',
    'retomarPostoAposSOS',
    'enviarCodigoAssumirGuarda',
    'validarCodigoAssumirGuarda',
    'assumirGuardaComEmailValidado',
    'enviarCodigoEncerrarGuarda',
    'validarCodigoEEncerrarGuarda',
    'enviarCodigoAssumirComandante',
    'validarCodigoAssumirComandante',
    'assumirComandanteComEmailValidado',
    'enviarCodigoEncerrarComandante',
    'validarCodigoEEncerrarComandante'
  ].forEach(nome => {
    executor[nome] = (...argumentos) => {
      chamarApi(nome, montarDadosChamadaApi(nome, argumentos))
        .then(resposta => sucesso(ajustarRespostaApi(nome, resposta)))
        .catch(erro => falha({ message: erro.message }));
    };
  });

  return executor;
}

window.google = window.google || {};
window.google.script = window.google.script || {};
Object.defineProperty(window.google.script, 'run', {
  configurable: false,
  get: criarExecutorAppsScript
});

  let tipoMovimentacaoAtual = 'Entrada';
  let modoRegistroAtual = 'Individual';
  let pessoaSelecionada = null;
  let condutorExternoAtivo = false;
  let ocupantesViatura = [];
  let destinos = [];
  let procedencias = [];
  let viaturasSOS = [];
  let militaresSOS = [];
  let selecoesViaturasSOS = {};

  let dadosCodigoGuarda = null;
  let guardaAtual = null;
  let emailEncerramentoGuarda = null;
  let dadosCodigoComandante = null;
  let comandanteAtual = null;
  let emailEncerramentoComandante = null;
  let painelComandanteCarregado = false;
  let pessoasDentroGuardaCarregadas = false;
  let statusToqueFogoAtual = null;
  let dadosCodigoToqueFogo = null;


  document.addEventListener('DOMContentLoaded', () => {
    carregarListas();
    selecionarModoRegistro('Individual');
    alternarTipoRegistro();
    carregarGuardaAtivo();
    carregarComandanteAtivo();
    carregarStatusToqueFogo();
    restaurarCodigoGuardaPendente();
    restaurarCodigoComandantePendente();
    aplicarCodigoDoLink();

    setInterval(() => {
      if (aparelhoPodeOperarGuardaAtual()) {
        carregarPessoasDentroGuarda(true);
      }

      carregarStatusToqueFogo(true);

      if (aparelhoAssumiuComandanteAtual()) {
        carregarPainelComandante(true);
      }
    }, 60000);
  });

  function selecionarMovimentacao(tipo) {
    tipoMovimentacaoAtual = tipo;

    document.getElementById('btnEntrada').classList.toggle('ativo', tipo === 'Entrada');
    document.getElementById('btnSaida').classList.toggle('ativo', tipo === 'Saída');

    preencherDestinos();
    preencherProcedencias();

    if (modoRegistroAtual === 'SOS') {
      renderizarSelecaoViaturasSOS();
    }
  }

  function normalizarPrefixoPlaca(campo) {
    campo.value = String(campo.value || '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function selecionarModoRegistro(modo) {
    modoRegistroAtual = ['Viatura', 'SOS'].includes(modo) ? modo : 'Individual';

    document.getElementById('btnModoIndividual').classList.toggle('ativo', modoRegistroAtual === 'Individual');
    document.getElementById('btnModoViatura').classList.toggle('ativo', modoRegistroAtual === 'Viatura');
    document.getElementById('btnModoSOS').classList.toggle('ativo', modoRegistroAtual === 'SOS');

    const isViatura = modoRegistroAtual === 'Viatura';
    const isSOS = modoRegistroAtual === 'SOS';
    const tipoRegistro = document.getElementById('tipoRegistro');

    if (isSOS) {
      tipoMovimentacaoAtual = 'Saída';
      selecoesViaturasSOS = {};
      document.getElementById('btnEntrada').classList.remove('ativo');
      document.getElementById('btnSaida').classList.add('ativo');
      carregarDadosSOS();
    } else if (isViatura) {
      tipoRegistro.value = 'Pessoa cadastrada';
    } else {
      condutorExternoAtivo = false;
      ocupantesViatura = [];
      renderizarOcupantesViatura();
    }

    document.getElementById('areaRegistroPadrao').classList.toggle('oculto', isSOS);
    document.getElementById('areaRegistroSOS').classList.toggle('oculto', !isSOS);
    document.getElementById('labelTipoMovimentacao').textContent = isSOS ? 'Movimentação de SOS' : 'Tipo de movimentação';
    document.getElementById('textoBtnEntrada').textContent = isSOS ? 'Retorno' : 'Entrada';
    document.getElementById('textoBtnSaida').textContent = 'Saída';

    document.getElementById('campoTipoRegistro').classList.toggle('oculto', isViatura);
    document.getElementById('areaOcupantesViatura').classList.toggle('oculto', !isViatura);
    document.getElementById('areaOpcaoCondutorExterno').classList.toggle('oculto', !isViatura || condutorExternoAtivo);
    document.getElementById('areaCondutorExterno').classList.toggle('oculto', !isViatura || !condutorExternoAtivo);
    document.getElementById('campoBuscaPessoaPrincipal').classList.toggle('oculto', isViatura && condutorExternoAtivo);
    document.getElementById('labelPessoaPrincipal').textContent = isViatura
      ? 'RG/CPF do condutor'
      : 'RG/CPF da pessoa cadastrada';
    document.getElementById('labelPrefixoPlaca').textContent = isViatura
      ? 'Prefixo/Placa da viatura *'
      : 'Prefixo/Placa';
    document.getElementById('prefixoPlaca').placeholder = isViatura
      ? 'Obrigatório'
      : 'Opcional';
    document.getElementById('btnRegistrarMovimentacao').textContent = isViatura
      ? 'Registrar viatura'
      : isSOS
        ? 'Registrar saída SOS'
        : 'Registrar';

    if (!isSOS) {
      alternarTipoRegistro();
    }
  }

  function alternarTipoRegistro() {
    if (modoRegistroAtual === 'Viatura') {
      document.getElementById('tipoRegistro').value = 'Pessoa cadastrada';
    }

    const tipoRegistro = document.getElementById('tipoRegistro').value;
    const isCadastrada = tipoRegistro === 'Pessoa cadastrada';

    document.getElementById('areaPessoaCadastrada').classList.toggle('oculto', !isCadastrada);
    document.getElementById('areaVisitante').classList.toggle('oculto', isCadastrada);

    pessoaSelecionada = null;

    const resultado = document.getElementById('resultadoPessoa');
    resultado.innerHTML = '';
    resultado.classList.add('oculto');
    resultado.classList.remove('erro');

    preencherDestinos();
    preencherProcedencias();
  }

  function carregarListas() {
    google.script.run
      .withSuccessHandler((dados) => {
        destinos = dados.destinos || [];
        procedencias = dados.procedencias || [];
        preencherDestinos();
        preencherProcedencias();
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao carregar listas: ' + erro.message, 'erro');
      })
      .getListasFormulario();
  }

  function carregarDadosSOS() {
    google.script.run
      .withSuccessHandler((dados) => {
        viaturasSOS = dados.viaturas || [];
        militaresSOS = dados.militares || [];
        renderizarSelecaoViaturasSOS();
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao carregar viaturas de SOS: ' + erro.message, 'erro');
      })
      .getDadosSOS();
  }

  function renderizarSelecaoViaturasSOS() {
    const lista = document.getElementById('listaViaturasSOS');
    const configuracoes = document.getElementById('configuracoesViaturasSOS');

    if (!lista || !configuracoes) return;

    const retorno = tipoMovimentacaoAtual === 'Entrada';
    const situacaoNecessaria = retorno ? 'Em ocorrência' : 'No quartel';
    const disponiveis = viaturasSOS.filter(item => item.Situacao_Atual === situacaoNecessaria);
    document.getElementById('tituloSelecaoSOS').textContent = retorno
      ? 'Selecionar viaturas que retornaram'
      : 'Selecionar viaturas para saída';
    document.getElementById('btnRegistrarMovimentacao').textContent = retorno
      ? 'Registrar retorno SOS'
      : 'Registrar saída SOS';

    Object.keys(selecoesViaturasSOS).forEach(id => {
      if (!disponiveis.some(item => item.ID_Viatura === id)) {
        delete selecoesViaturasSOS[id];
      }
    });

    lista.innerHTML = '';

    if (!disponiveis.length) {
      lista.appendChild(criarEstadoVazioPainel(
        retorno
          ? 'Não há viaturas em ocorrência.'
          : 'Não há viaturas disponíveis no quartel.'
      ));
      configuracoes.innerHTML = '';
      return;
    }

    disponiveis.forEach(viatura => {
      const rotulo = document.createElement('label');
      rotulo.className = 'opcao-viatura-sos';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(selecoesViaturasSOS[viatura.ID_Viatura]);
      checkbox.onchange = () => alternarViaturaSOS(viatura, checkbox.checked);

      const texto = document.createElement('span');
      const prefixo = document.createElement('strong');
      prefixo.textContent = viatura.Prefixo;
      const descricao = document.createElement('small');
      descricao.textContent = viatura.Descricao || viatura.Situacao_Atual;
      texto.appendChild(prefixo);
      texto.appendChild(descricao);
      rotulo.appendChild(checkbox);
      rotulo.appendChild(texto);
      lista.appendChild(rotulo);
    });

    renderizarConfiguracoesSOS();
  }

  function alternarViaturaSOS(viatura, selecionada) {
    if (selecionada) {
      selecoesViaturasSOS[viatura.ID_Viatura] = {
        ID_Viatura: viatura.ID_Viatura,
        ID_Condutor: tipoMovimentacaoAtual === 'Entrada' ? viatura.ID_Condutor_Atual : '',
        IDs_Guarnicao: tipoMovimentacaoAtual === 'Entrada'
          ? (viatura.IDs_Guarnicao_Atual || []).slice()
          : []
      };
    } else {
      delete selecoesViaturasSOS[viatura.ID_Viatura];
    }

    renderizarConfiguracoesSOS();
  }

  function criarSelectMilitaresSOS(valorAtual, textoInicial) {
    const select = document.createElement('select');
    const inicial = document.createElement('option');
    inicial.value = '';
    inicial.textContent = textoInicial;
    select.appendChild(inicial);

    militaresSOS.forEach(militar => {
      const option = document.createElement('option');
      option.value = militar.ID_Pessoa;
      option.textContent = militar.Nome + (militar.RG_CPF ? ' — ' + militar.RG_CPF : '');
      option.selected = militar.ID_Pessoa === valorAtual;
      select.appendChild(option);
    });

    return select;
  }

  function renderizarConfiguracoesSOS() {
    const area = document.getElementById('configuracoesViaturasSOS');
    area.innerHTML = '';

    Object.values(selecoesViaturasSOS).forEach(selecao => {
      const viatura = viaturasSOS.find(item => item.ID_Viatura === selecao.ID_Viatura);
      if (!viatura) return;

      const card = document.createElement('div');
      card.className = 'configuracao-viatura-sos';
      const titulo = document.createElement('strong');
      titulo.textContent = viatura.Prefixo + (viatura.Descricao ? ' — ' + viatura.Descricao : '');
      card.appendChild(titulo);

      const labelCondutor = document.createElement('label');
      labelCondutor.textContent = 'Condutor';
      const selectCondutor = criarSelectMilitaresSOS(selecao.ID_Condutor, 'Selecione o condutor');
      selectCondutor.disabled = tipoMovimentacaoAtual === 'Entrada';
      selectCondutor.onchange = () => {
        selecao.ID_Condutor = selectCondutor.value;
        selecao.IDs_Guarnicao = selecao.IDs_Guarnicao.filter(id => id !== selectCondutor.value);
        renderizarConfiguracoesSOS();
      };
      card.appendChild(labelCondutor);
      card.appendChild(selectCondutor);

      const labelGuarnicao = document.createElement('label');
      labelGuarnicao.textContent = 'Guarnição (opcional)';
      card.appendChild(labelGuarnicao);
      const linhaAdicionar = document.createElement('div');
      linhaAdicionar.className = 'linha-adicionar-guarnicao';
      const selectGuarnicao = criarSelectMilitaresSOS('', 'Selecione um integrante');
      Array.from(selectGuarnicao.options).forEach(option => {
        if (option.value && (
          option.value === selecao.ID_Condutor ||
          selecao.IDs_Guarnicao.includes(option.value)
        )) {
          option.remove();
        }
      });
      const adicionar = document.createElement('button');
      adicionar.type = 'button';
      adicionar.textContent = 'Adicionar';
      adicionar.onclick = () => {
        if (selectGuarnicao.value) {
          selecao.IDs_Guarnicao.push(selectGuarnicao.value);
          renderizarConfiguracoesSOS();
        }
      };
      linhaAdicionar.appendChild(selectGuarnicao);
      linhaAdicionar.appendChild(adicionar);
      card.appendChild(linhaAdicionar);

      const chips = document.createElement('div');
      chips.className = 'chips-guarnicao';
      selecao.IDs_Guarnicao.forEach(id => {
        const militar = militaresSOS.find(item => item.ID_Pessoa === id);
        if (!militar) return;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = militar.Nome + ' ×';
        chip.onclick = () => {
          selecao.IDs_Guarnicao = selecao.IDs_Guarnicao.filter(item => item !== id);
          renderizarConfiguracoesSOS();
        };
        chips.appendChild(chip);
      });
      card.appendChild(chips);
      area.appendChild(card);
    });
  }

  function registrarSOS() {
    const viaturas = Object.values(selecoesViaturasSOS);

    if (!viaturas.length) {
      mostrarMensagem('Selecione ao menos uma viatura.', 'erro');
      return;
    }

    if (viaturas.some(item => !item.ID_Condutor)) {
      mostrarMensagem('Selecione o condutor de cada viatura.', 'erro');
      return;
    }

    const botao = document.getElementById('btnRegistrarMovimentacao');
    bot…11431 tokens truncated…nst botao = document.getElementById('btnAssumirComandante');
  botao.disabled = true;
  botao.textContent = 'Assumindo...';

  google.script.run
    .withSuccessHandler((resposta) => {
      botao.disabled = false;
      botao.textContent = 'Assumir como comandante';

      if (resposta && resposta.requerConfirmacaoTroca && resposta.comandanteAtivo) {
        const comandante = resposta.comandanteAtivo;

        abrirModalConfirmacao(
          'Comandante já assumido',
          `Já existe um Comandante da Guarda ativo:<br><br>
          <strong>${comandante.Nome_Comandante} — RG ${comandante.RG_Comandante}</strong><br><br>
          Deseja encerrar somente a sessão do comandante anterior e assumir neste celular?`,
          () => assumirComandante(true),
          true
        );
        return;
      }

      mostrarMensagem(resposta.mensagem || 'Comandante da Guarda assumido com sucesso.', 'sucesso');

      if (resposta && resposta.comandante) {
        comandanteAtual = resposta.comandante;
        salvarComandanteLocal(resposta.comandante);
        atualizarTelaComandante();
      }

      limparAreaComandante();
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao assumir como comandante: ' + erro.message, 'erro');
      botao.disabled = false;
      botao.textContent = 'Assumir como comandante';
    })
    .assumirComandanteComEmailValidado({
      email: dadosCodigoComandante.email,
      militar: dadosCodigoComandante.militar,
      ticketAssuncao: dadosCodigoComandante.ticketAssuncao || '',
      encerrarAnterior: encerrarAnterior
    });
}

function encerrarComandante() {
  abrirModalConfirmacao(
    'Encerrar Comandante da Guarda',
    'Será enviado um código para o e-mail do comandante atual.<br><br>Após a confirmação, o relatório das 08h às 08h será criado, arquivado no Drive da Guarda e enviado ao comandante.<br><br>Deseja continuar?',
    () => enviarCodigoParaEncerrarComandante(),
    true
  );
}

function enviarCodigoParaEncerrarComandante() {
  const botao = document.getElementById('btnEncerrarComandante');
  botao.disabled = true;
  botao.textContent = 'Enviando...';

  google.script.run
    .withSuccessHandler((resposta) => {
      emailEncerramentoComandante = resposta.email;
      document.getElementById('areaCodigoEncerrarComandante').classList.remove('oculto');
      mostrarMensagem('Código enviado ao e-mail do comandante atual.', 'sucesso');
      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao enviar código do comandante: ' + erro.message, 'erro');
      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .enviarCodigoEncerrarComandante();
}

function validarCodigoEEncerrarComandante() {
  const codigo = document.getElementById('codigoEncerrarComandante').value.trim();

  if (!emailEncerramentoComandante || !codigo) {
    mostrarMensagem('Informe o código enviado ao comandante atual.', 'erro');
    return;
  }

  google.script.run
    .withSuccessHandler((resposta) => {
      mostrarMensagem(resposta.mensagem || 'Comandante da Guarda encerrado com sucesso.', 'sucesso');
      comandanteAtual = null;
      emailEncerramentoComandante = null;
      limparComandanteLocal();
      limparAreaComandante();
      atualizarTelaComandante();
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao encerrar comandante: ' + erro.message, 'erro');
    })
    .validarCodigoEEncerrarComandante(emailEncerramentoComandante, codigo);
}

function limparAreaComandante() {
  dadosCodigoComandante = null;
  emailEncerramentoComandante = null;
  limparCodigoComandantePendente();

  [
    'emailComandante',
    'codigoComandante',
    'codigoEncerrarComandante'
  ].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = '';
  });

  [
    'areaCodigoComandante',
    'areaCodigoEncerrarComandante',
    'areaComandanteIdentificado',
    'btnAssumirComandante'
  ].forEach(id => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.classList.add('oculto');
  });

  const identificado = document.getElementById('areaComandanteIdentificado');
  if (identificado) identificado.innerHTML = '';
}

function salvarCodigoComandantePendente(email) {
  localStorage.setItem('comandante_email_pendente', email);
  localStorage.setItem('comandante_codigo_pendente_em', new Date().toISOString());
}

function limparCodigoComandantePendente() {
  localStorage.removeItem('comandante_email_pendente');
  localStorage.removeItem('comandante_codigo_pendente_em');
}

function restaurarCodigoComandantePendente() {
  const email = localStorage.getItem('comandante_email_pendente');
  const geradoEm = localStorage.getItem('comandante_codigo_pendente_em');

  if (!email || !geradoEm) return;

  if ((new Date() - new Date(geradoEm)) / 60000 > 10) {
    limparCodigoComandantePendente();
    return;
  }

  document.getElementById('emailComandante').value = email;
  document.getElementById('areaCodigoComandante').classList.remove('oculto');
  dadosCodigoComandante = { email: email, militar: null, ticketAssuncao: '' };
}

function salvarComandanteLocal(comandante) {
  if (!comandante || !comandante.ID_ComandanteGuarda) return;

  localStorage.setItem('comandante_id_local', comandante.ID_ComandanteGuarda);
  localStorage.setItem('comandante_nome_local', comandante.Nome_Comandante || '');
  localStorage.setItem('comandante_rg_local', comandante.RG_Comandante || '');
  localStorage.setItem('comandante_email_local', comandante.Email_Comandante || '');

  if (comandante.Sessao_Token) {
    localStorage.setItem('comandante_sessao_token', comandante.Sessao_Token);
  }
}

function limparComandanteLocal() {
  localStorage.removeItem('comandante_id_local');
  localStorage.removeItem('comandante_nome_local');
  localStorage.removeItem('comandante_rg_local');
  localStorage.removeItem('comandante_email_local');
  localStorage.removeItem('comandante_sessao_token');
}

function aparelhoAssumiuComandanteAtual() {
  if (!comandanteAtual || !comandanteAtual.ID_ComandanteGuarda) return false;

  const idLocal = localStorage.getItem('comandante_id_local');
  const tokenLocal = localStorage.getItem('comandante_sessao_token');

  return !!(
    idLocal &&
    idLocal === comandanteAtual.ID_ComandanteGuarda &&
    comandanteAtual.Sessao_Valida !== false &&
    (tokenLocal || typeof URL_API === 'undefined')
  );
}


let acaoConfirmadaModal = null;

function abrirModalConfirmacao(titulo, texto, callback, modoPerigo = false) {
  document.getElementById('modalTitulo').textContent = titulo;
  document.getElementById('modalTexto').innerHTML = texto;

  const botaoConfirmar = document.getElementById('btnModalConfirmar');
  botaoConfirmar.classList.toggle('perigo', modoPerigo);
  botaoConfirmar.onclick = () => {
    fecharModalConfirmacao();

    if (typeof callback === 'function') {
      callback();
    }
  };

  document.getElementById('modalConfirmacao').classList.remove('oculto');
}

function fecharModalConfirmacao() {
  document.getElementById('modalConfirmacao').classList.add('oculto');
}

function enviarCodigoParaEncerrarGuarda() {
  const botao = document.getElementById('btnEncerrarGuarda');
  botao.disabled = true;
  botao.textContent = 'Enviando...';

  google.script.run
    .withSuccessHandler((resposta) => {
      emailEncerramentoGuarda = resposta.email;

      document.getElementById('areaCodigoEncerrarGuarda').classList.remove('oculto');

      mostrarMensagem(
        'Código enviado para o e-mail do guarda atual. Informe o código para encerrar.',
        'sucesso'
      );

      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao enviar código: ' + erro.message, 'erro');

      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .enviarCodigoEncerrarGuarda();
}

function validarCodigoEEncerrarGuarda() {
  const codigo = document.getElementById('codigoEncerrarGuarda').value.trim();

  if (!emailEncerramentoGuarda || !codigo) {
    mostrarMensagem('Informe o código enviado ao guarda atual.', 'erro');
    return;
  }

  google.script.run
    .withSuccessHandler((resposta) => {
      mostrarMensagem(resposta.mensagem || 'Guarda encerrada com sucesso.', 'sucesso');

      guardaAtual = null;
      emailEncerramentoGuarda = null;

      limparGuardaLocal();

      document.getElementById('codigoEncerrarGuarda').value = '';
      document.getElementById('areaCodigoEncerrarGuarda').classList.add('oculto');

      limparAreaGuarda();
      atualizarTelaGuarda();
      carregarStatusToqueFogo(true);
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao encerrar Guarda: ' + erro.message, 'erro');
    })
    .validarCodigoEEncerrarGuarda(emailEncerramentoGuarda, codigo);
}

function salvarGuardaLocal(guarda) {
  if (!guarda || !guarda.ID_GuardaServico) {
    return;
  }

  localStorage.setItem('guarda_id_local', guarda.ID_GuardaServico);
  localStorage.setItem('guarda_nome_local', guarda.Nome_Guarda || '');
  localStorage.setItem('guarda_rg_local', guarda.RG_Guarda || '');
  localStorage.setItem('guarda_email_local', guarda.Email_Guarda || '');
  localStorage.setItem('guarda_sessao_token', guarda.Sessao_Token || '');
}

function limparGuardaLocal() {
  localStorage.removeItem('guarda_id_local');
  localStorage.removeItem('guarda_nome_local');
  localStorage.removeItem('guarda_rg_local');
  localStorage.removeItem('guarda_email_local');
  localStorage.removeItem('guarda_sessao_token');
}

function aparelhoAssumiuGuardaAtual() {
  if (!guardaAtual || !guardaAtual.ID_GuardaServico) {
    return false;
  }

  const idLocal = localStorage.getItem('guarda_id_local');
  const sessaoToken = obterSessaoTokenLocal();

  return !!(
    idLocal &&
    sessaoToken &&
    idLocal === guardaAtual.ID_GuardaServico &&
    guardaAtual.Sessao_Valida === true
  );
}

function atualizarVisibilidadePessoasDentroGuarda() {
  const card = document.getElementById('cardPessoasDentroGuarda');

  if (!card) return;

  if (aparelhoPodeOperarGuardaAtual()) {
    card.classList.remove('oculto');
    restaurarEstadoPessoasDentroGuarda();

    if (!pessoasDentroGuardaCarregadas) {
      carregarPessoasDentroGuarda(true);
    }
  } else {
    card.classList.add('oculto');
    pessoasDentroGuardaCarregadas = false;
  }
}

function carregarStatusToqueFogo(silencioso = false) {
  google.script.run
    .withSuccessHandler((status) => {
      statusToqueFogoAtual = status || null;
      atualizarTelaToqueFogo();
    })
    .withFailureHandler((erro) => {
      if (!silencioso) mostrarMensagem('Erro ao carregar Toque de Fogo: ' + erro.message, 'erro');
    })
    .getStatusToqueFogo();
}

function atualizarTelaToqueFogo() {
  const status = statusToqueFogoAtual || {};
  const periodo = status.periodo || {};
  const toque = status.toque || null;
  const cobertura = status.cobertura || null;
  const statusEl = document.getElementById('statusToqueFogo');
  const periodoEl = document.getElementById('periodoToqueFogo');
  const areaAssumir = document.getElementById('areaAssumirToqueFogo');
  const btnTrocar = document.getElementById('btnTrocarToqueFogo');
  const coberturaEl = document.getElementById('statusCoberturaToque');
  const btnRetomar = document.getElementById('btnRetomarPosto');

  periodoEl.textContent = (periodo.nome || 'Período atual') + ' • ' + (periodo.faixa || '');
  statusEl.classList.remove('sem-guarda', 'com-guarda');

  if (toque) {
    statusEl.classList.add('com-guarda');
    statusEl.innerHTML = 'Toque de Fogo atual:<br>' + escaparHtml(toque.Nome_Toque) +
      ' — RG ' + escaparHtml(toque.RG_Toque);
    areaAssumir.classList.add('oculto');
    btnTrocar.classList.toggle('oculto', aparelhoAssumiuToqueAtual());
  } else {
    statusEl.classList.add('sem-guarda');
    statusEl.textContent = 'Nenhum Toque de Fogo assumiu o período ' + (periodo.faixa || 'atual') + '.';
    areaAssumir.classList.remove('oculto');
    btnTrocar.classList.add('oculto');
    limparToqueFogoLocal();
  }

  if (cobertura) {
    coberturaEl.classList.remove('oculto');
    coberturaEl.innerHTML = '<strong>Cobertura ativa</strong><br>' +
      escaparHtml(cobertura.Nome_Toque) + ' está no posto por ' +
      escaparHtml(cobertura.Nome_Guarda_Titular) + '.<br>' +
      'Início: ' + escaparHtml(cobertura.DataHora_Inicio || '-');
  } else {
    coberturaEl.classList.add('oculto');
    coberturaEl.innerHTML = '';
  }

  const titularPodeRetomar = !!(
    cobertura && guardaAtual && aparelhoAssumiuGuardaAtual() &&
    cobertura.ID_GuardaServico_Titular === guardaAtual.ID_GuardaServico
  );
  btnRetomar.classList.toggle('oculto', !titularPodeRetomar);
  atualizarPermissaoLancamento();
}

function mostrarAreaTrocaToqueFogo() {
  document.getElementById('areaAssumirToqueFogo').classList.remove('oculto');
  mostrarMensagem('Valide o e-mail do militar que assumirá o Toque de Fogo neste período.', 'sucesso');
}

function enviarCodigoToqueFogo() {
  const email = document.getElementById('emailToqueFogo').value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    mostrarMensagem('Informe um e-mail válido.', 'erro');
    return;
  }
  google.script.run
    .withSuccessHandler((resposta) => {
      dadosCodigoToqueFogo = {
        email: resposta.email,
        encontradoNoEfetivo: resposta.encontradoNoEfetivo,
        militar: resposta.militar || null,
        ticketAssuncao: ''
      };
      document.getElementById('areaCodigoToqueFogo').classList.remove('oculto');
      mostrarMensagem('Código enviado para o e-mail do Toque de Fogo.', 'sucesso');
    })
    .withFailureHandler((erro) => mostrarMensagem('Erro ao enviar código: ' + erro.message, 'erro'))
    .enviarCodigoAssumirToqueFogo(email);
}

function validarCodigoToqueFogo() {
  const email = document.getElementById('emailToqueFogo').value.trim().toLowerCase();
  const codigo = document.getElementById('codigoToqueFogo').value.trim();
  if (!email || !codigo) {
    mostrarMensagem('Informe o e-mail e o código.', 'erro');
    return;
  }
  google.script.run
    .withSuccessHandler((resposta) => {
      dadosCodigoToqueFogo = {
        email: resposta.email,
        encontradoNoEfetivo: resposta.encontradoNoEfetivo,
        militar: resposta.militar || null,
        ticketAssuncao: resposta.ticketAssuncao || ''
      };
      const area = document.getElementById('areaToqueFogoIdentificado');
      const manual = document.getElementById('areaToqueFogoManual');
      area.classList.remove('oculto');
      document.getElementById('btnAssumirToqueFogo').classList.remove('oculto');
      if (resposta.encontradoNoEfetivo && resposta.militar) {
        area.innerHTML = 'Militar identificado:<br>' + escaparHtml(resposta.militar.Nome) +
          ' — RG ' + escaparHtml(resposta.militar.RG);
        manual.classList.add('oculto');
      } else {
        area.textContent = 'E-mail validado. Informe RG e nome do militar.';
        manual.classList.remove('oculto');
      }
      mostrarMensagem('Código validado com sucesso.', 'sucesso');
    })
    .withFailureHandler((erro) => mostrarMensagem('Erro ao validar código: ' + erro.message, 'erro'))
    .validarCodigoAssumirToqueFogo(email, codigo);
}

function assumirToqueFogo(encerrarAnterior = false) {
  if (!dadosCodigoToqueFogo) {
    mostrarMensagem('Valide o e-mail antes de assumir o Toque de Fogo.', 'erro');
    return;
  }
  const botao = document.getElementById('btnAssumirToqueFogo');
  botao.disabled = true;
  botao.textContent = 'Assumindo...';
  const dados = {
    email: dadosCodigoToqueFogo.email,
    origemIdentificacao: dadosCodigoToqueFogo.encontradoNoEfetivo ? 'Efetivo' : 'Manual',
    militar: dadosCodigoToqueFogo.militar,
    rgManual: document.getElementById('rgToqueFogoManual').value.trim(),
    nomeManual: document.getElementById('nomeToqueFogoManual').value.trim(),
    ticketAssuncao: dadosCodigoToqueFogo.ticketAssuncao || '',
    encerrarAnterior: encerrarAnterior
  };
  google.script.run
    .withSuccessHandler((resposta) => {
      botao.disabled = false;
      botao.textContent = 'Assumir Toque de Fogo';
      if (resposta.requerConfirmacaoTroca && resposta.toqueAtivo) {
        abrirModalConfirmacao(
          'Toque de Fogo já assumido',
          'O período está assumido por <strong>' + escaparHtml(resposta.toqueAtivo.Nome_Toque) +
            '</strong>.<br><br>Deseja realizar a troca?',
          () => assumirToqueFogo(true),
          true
        );
        return;
      }
      if (resposta.toque) salvarToqueFogoLocal(resposta.toque);
      statusToqueFogoAtual = resposta.statusToque || statusToqueFogoAtual;
      limparAreaToqueFogo();
      carregarStatusToqueFogo(true);
      mostrarMensagem(resposta.mensagem || 'Toque de Fogo assumido.', 'sucesso');
    })
    .withFailureHandler((erro) => {
      botao.disabled = false;
      botao.textContent = 'Assumir Toque de Fogo';
      mostrarMensagem('Erro ao assumir Toque de Fogo: ' + erro.message, 'erro');
    })
    .assumirToqueFogoComEmailValidado(dados);
}

function limparAreaToqueFogo() {
  dadosCodigoToqueFogo = null;
  ['emailToqueFogo', 'codigoToqueFogo', 'rgToqueFogoManual', 'nomeToqueFogoManual'].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = '';
  });
  ['areaCodigoToqueFogo', 'areaToqueFogoIdentificado', 'areaToqueFogoManual', 'btnAssumirToqueFogo'].forEach(id => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.classList.add('oculto');
  });
}

function salvarToqueFogoLocal(toque) {
  if (!toque || !toque.ID_ToqueFogo) return;
  localStorage.setItem('toque_fogo_id_local', toque.ID_ToqueFogo);
  localStorage.setItem('toque_fogo_sessao_token', toque.Sessao_Token || '');
}

function limparToqueFogoLocal() {
  localStorage.removeItem('toque_fogo_id_local');
  localStorage.removeItem('toque_fogo_sessao_token');
}

function aparelhoAssumiuToqueAtual() {
  const toque = statusToqueFogoAtual && statusToqueFogoAtual.toque;
  if (!toque || !toque.ID_ToqueFogo) return false;
  const idLocal = localStorage.getItem('toque_fogo_id_local');
  const token = localStorage.getItem('toque_fogo_sessao_token');
  return !!(idLocal && token && idLocal === toque.ID_ToqueFogo && toque.Sessao_Valida === true);
}

function aparelhoPodeOperarGuardaAtual() {
  const cobertura = statusToqueFogoAtual && statusToqueFogoAtual.cobertura;
  return aparelhoAssumiuGuardaAtual() || !!(cobertura && aparelhoAssumiuToqueAtual());
}

function confirmarRetomadaPosto() {
  abrirModalConfirmacao(
    'Retomar posto',
    'Confirma que o militar da hora retornou e está retomando o posto da Guarda?',
    () => retomarPostoAposSOS()
  );
}

function retomarPostoAposSOS() {
  google.script.run
    .withSuccessHandler((resposta) => {
      statusToqueFogoAtual = resposta.statusToque || null;
      atualizarTelaToqueFogo();
      mostrarMensagem(resposta.mensagem, 'sucesso');
    })
    .withFailureHandler((erro) => mostrarMensagem('Erro ao retomar o posto: ' + erro.message, 'erro'))
    .retomarPostoAposSOS();
}

function atualizarPermissaoLancamento() {
  const cardMovimentacao = document.getElementById('cardMovimentacao');
  const aviso = document.getElementById('avisoSemPermissaoLancamento');

  if (!cardMovimentacao || !aviso) {
    return;
  }

  const podeLancar = guardaAtual && aparelhoPodeOperarGuardaAtual();

  atualizarVisibilidadePessoasDentroGuarda();

  if (podeLancar) {
    cardMovimentacao.classList.remove('oculto');
    aviso.classList.add('oculto');
  } else {
    cardMovimentacao.classList.add('oculto');

    if (guardaAtual) {
      aviso.classList.remove('oculto');
    } else {
      aviso.classList.add('oculto');
    }
  }
}

