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
    throw new Error('NÃ£o foi possÃ­vel conectar ao servidor. Verifique a internet e tente novamente.');
  }

  if (!resposta.ok) {
    throw new Error('Falha de comunicaÃ§Ã£o com o servidor.');
  }

  const resultado = await resposta.json();

  if (!resultado.sucesso) {
    throw new Error(resultado.mensagem || 'Erro ao executar a aÃ§Ã£o.');
  }

  return resultado.resposta;
}

function obterSessaoTokenLocal() {
  return localStorage.getItem('guarda_sessao_token') || '';
}

function obterSessaoTokenComandanteLocal() {
  return localStorage.getItem('comandante_sessao_token') || '';
}

function montarDadosChamadaApi(nome, argumentos) {
  const sessaoToken = obterSessaoTokenLocal();
  const sessaoComandanteToken = obterSessaoTokenComandanteLocal();

  switch (nome) {
    case 'getListasFormulario':
      return {};
    case 'getGuardaAtivo':
      return { sessaoToken: sessaoToken };
    case 'getComandanteAtivo':
      return { sessaoToken: sessaoComandanteToken };
    case 'buscarPessoasPorRgCpf':
      return { rgCpf: argumentos[0], sessaoToken: sessaoToken };
    case 'registrarMovimentacao':
      return { movimentacao: argumentos[0], sessaoToken: sessaoToken };
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
    'buscarPessoasPorRgCpf',
    'registrarMovimentacao',
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

  let dadosCodigoGuarda = null;
  let guardaAtual = null;
  let emailEncerramentoGuarda = null;
  let dadosCodigoComandante = null;
  let comandanteAtual = null;
  let emailEncerramentoComandante = null;


  document.addEventListener('DOMContentLoaded', () => {
    carregarListas();
    selecionarModoRegistro('Individual');
    alternarTipoRegistro();
    carregarGuardaAtivo();
    carregarComandanteAtivo();
    restaurarCodigoGuardaPendente();
    restaurarCodigoComandantePendente();
    aplicarCodigoDoLink();
  });

  function selecionarMovimentacao(tipo) {
    tipoMovimentacaoAtual = tipo;

    document.getElementById('btnEntrada').classList.toggle('ativo', tipo === 'Entrada');
    document.getElementById('btnSaida').classList.toggle('ativo', tipo === 'SaÃ­da');

    preencherDestinos();
    preencherProcedencias();
  }

  function normalizarPrefixoPlaca(campo) {
    campo.value = String(campo.value || '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function selecionarModoRegistro(modo) {
    modoRegistroAtual = modo === 'Viatura' ? 'Viatura' : 'Individual';

    document.getElementById('btnModoIndividual').classList.toggle('ativo', modoRegistroAtual === 'Individual');
    document.getElementById('btnModoViatura').classList.toggle('ativo', modoRegistroAtual === 'Viatura');

    const isViatura = modoRegistroAtual === 'Viatura';
    const tipoRegistro = document.getElementById('tipoRegistro');

    if (isViatura) {
      tipoRegistro.value = 'Pessoa cadastrada';
    } else {
      condutorExternoAtivo = false;
      ocupantesViatura = [];
      renderizarOcupantesViatura();
    }

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
      ? 'ObrigatÃ³rio'
      : 'Opcional';
    document.getElementById('btnRegistrarMovimentacao').textContent = isViatura
      ? 'Registrar viatura'
      : 'Registrar';

    alternarTipoRegistro();
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

  function preencherDestinos() {
    const select = document.getElementById('destino');
    const tipoRegistro = document.getElementById('tipoRegistro').value;
    const visitante = tipoRegistro === 'Visitante eventual';

    select.innerHTML = '';

    const lista = destinos.filter(item => {
      const ativo = String(item.Ativo).toLowerCase() === 'sim';
      const mesmoTipo = item.Tipo_Movimentacao === tipoMovimentacaoAtual;
      const permitidoVisitante = !visitante || String(item.Permitido_Para_Visitante).toLowerCase() === 'sim';

      return ativo && mesmoTipo && permitidoVisitante;
    });

    lista.sort((a, b) => Number(a.Ordem || 999) - Number(b.Ordem || 999));

    lista.forEach(item => {
      const option = document.createElement('option');
      option.value = item.Destino;
      option.textContent = item.Destino;
      select.appendChild(option);
    });
  }

  function preencherProcedencias() {
    const select = document.getElementById('procedencia');
    const tipoRegistro = document.getElementById('tipoRegistro').value;
    const visitante = tipoRegistro === 'Visitante eventual';

    select.innerHTML = '';

    const lista = procedencias.filter(item => {
      const ativo = String(item.Ativo).toLowerCase() === 'sim';
      const mesmoTipo = item.Tipo_Movimentacao === tipoMovimentacaoAtual;
      const permitidoVisitante = !visitante || String(item.Permitido_Para_Visitante).toLowerCase() === 'sim';

      return ativo && mesmoTipo && permitidoVisitante;
    });

    lista.sort((a, b) => Number(a.Ordem || 999) - Number(b.Ordem || 999));

    lista.forEach(item => {
      const option = document.createElement('option');
      option.value = item.ProcedÃªncia;
      option.textContent = item.ProcedÃªncia;
      option.dataset.exigeComplemento = item.Exige_Complemento;
      select.appendChild(option);
    });

    verificarComplementoProcedencia();
  }

  function verificarComplementoProcedencia() {
    const select = document.getElementById('procedencia');
    const option = select.options[select.selectedIndex];

    if (!option) return;

    const exige = String(option.dataset.exigeComplemento).toLowerCase() === 'sim';
    document.getElementById('areaComplementoProcedencia').classList.toggle('oculto', !exige);

    const label = document.getElementById('labelComplementoProcedencia');
    const valor = option.value;

    if (valor === 'Empresa terceirizada') {
      label.textContent = 'Qual empresa?';
    } else if (valor === 'Outra OBM') {
      label.textContent = 'Qual OBM?';
    } else {
      label.textContent = 'Complemento da procedÃªncia';
    }
  }

  function buscarPessoa() {
    const rgCpf = document.getElementById('rgCpfBusca').value.trim();

    if (!rgCpf || rgCpf.replace(/\D/g, '').length < 3) {
      mostrarMensagem('Digite pelo menos 3 dÃ­gitos do RG/CPF.', 'erro');
      return;
    }

    google.script.run
      .withSuccessHandler((pessoas) => {
        const resultado = document.getElementById('resultadoPessoa');
        resultado.classList.remove('oculto', 'erro');
        resultado.innerHTML = '';

        pessoaSelecionada = null;

        if (modoRegistroAtual === 'Viatura') {
          pessoas = (pessoas || []).filter(pessoa => {
            return String(pessoa.Tipo_Pessoa || '').trim().toLowerCase() === 'militar';
          });
        }

        if (!pessoas || pessoas.length === 0) {
          resultado.classList.add('erro');
          resultado.textContent = 'Nenhuma pessoa encontrada.';
          return;
        }

        pessoas.forEach(pessoa => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'item-pessoa';
          item.textContent = `${pessoa.Nome} â€” ${pessoa.RG_CPF}`;
          item.onclick = () => selecionarPessoaEncontrada(pessoa);

          resultado.appendChild(item);
        });
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao buscar pessoa: ' + erro.message, 'erro');
      })
      .buscarPessoasPorRgCpf(rgCpf);
  }

  function selecionarPessoaEncontrada(pessoa) {
    if (
      modoRegistroAtual === 'Viatura' &&
      ocupantesViatura.some(item => item.chaveLista === criarChaveParticipanteViatura(pessoa))
    ) {
      mostrarMensagem('Este militar jÃ¡ foi adicionado como ocupante.', 'erro');
      return;
    }

    if (modoRegistroAtual === 'Viatura') {
      condutorExternoAtivo = false;
      document.getElementById('areaCondutorExterno').classList.add('oculto');
      document.getElementById('campoBuscaPessoaPrincipal').classList.remove('oculto');
      document.getElementById('areaOpcaoCondutorExterno').classList.remove('oculto');
    }

    pessoaSelecionada = pessoa;

    const resultado = document.getElementById('resultadoPessoa');
    resultado.classList.remove('erro');
    resultado.innerHTML = `
      <div class="pessoa-selecionada">
        Selecionado: ${pessoa.Nome} â€” ${pessoa.RG_CPF}
      </div>
    `;
  }

  function alternarCondutorExterno() {
    condutorExternoAtivo = !condutorExternoAtivo;
    pessoaSelecionada = null;

    document.getElementById('campoBuscaPessoaPrincipal').classList.toggle('oculto', condutorExternoAtivo);
    document.getElementById('areaOpcaoCondutorExterno').classList.toggle('oculto', condutorExternoAtivo);
    document.getElementById('areaCondutorExterno').classList.toggle('oculto', !condutorExternoAtivo);
    document.getElementById('resultadoPessoa').innerHTML = '';
    document.getElementById('resultadoPessoa').classList.add('oculto');

    if (!condutorExternoAtivo) {
      document.getElementById('nomeCondutorExterno').value = '';
      document.getElementById('rgCondutorExterno').value = '';
    }
  }

  function buscarOcupanteViatura() {
    const rgCpf = document.getElementById('rgCpfBuscaOcupante').value.trim();

    if (!rgCpf || rgCpf.replace(/\D/g, '').length < 3) {
      mostrarMensagem('Digite pelo menos 3 dÃ­gitos do RG/CPF do ocupante.', 'erro');
      return;
    }

    google.script.run
      .withSuccessHandler((pessoas) => {
        const resultado = document.getElementById('resultadoOcupanteViatura');
        resultado.classList.remove('oculto', 'erro');
        resultado.innerHTML = '';

        pessoas = (pessoas || []).filter(pessoa => {
          return String(pessoa.Tipo_Pessoa || '').trim().toLowerCase() === 'militar';
        });

        if (!pessoas || pessoas.length === 0) {
          resultado.classList.add('erro');
          resultado.textContent = 'Nenhum ocupante encontrado.';
          return;
        }

        pessoas.forEach(pessoa => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'item-pessoa';
          item.textContent = `${pessoa.Nome} â€” ${pessoa.RG_CPF}`;
          item.onclick = () => adicionarOcupanteViatura(pessoa);
          resultado.appendChild(item);
        });
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao buscar ocupante: ' + erro.message, 'erro');
      })
      .buscarPessoasPorRgCpf(rgCpf);
  }

  function adicionarOcupanteViatura(pessoa) {
    const participante = Object.assign({}, pessoa, {
      origem: 'Cadastro',
      chaveLista: criarChaveParticipanteViatura(pessoa)
    });

    if (pessoaSelecionada && criarChaveParticipanteViatura(pessoaSelecionada) === participante.chaveLista) {
      mostrarMensagem('O condutor nÃ£o pode ser adicionado tambÃ©m como ocupante.', 'erro');
      return;
    }

    if (ocupantesViatura.some(item => item.chaveLista === participante.chaveLista)) {
      mostrarMensagem('Este militar jÃ¡ estÃ¡ na lista de ocupantes.', 'erro');
      return;
    }

    ocupantesViatura.push(participante);
    document.getElementById('rgCpfBuscaOcupante').value = '';
    document.getElementById('resultadoOcupanteViatura').innerHTML = '';
    document.getElementById('resultadoOcupanteViatura').classList.add('oculto');
    renderizarOcupantesViatura();
    document.getElementById('rgCpfBuscaOcupante').focus();
  }

  function alternarFormularioOcupanteExterno() {
    const area = document.getElementById('areaOcupanteExterno');
    area.classList.toggle('oculto');

    if (area.classList.contains('oculto')) {
      document.getElementById('nomeOcupanteExterno').value = '';
      document.getElementById('rgOcupanteExterno').value = '';
    }
  }

  function adicionarOcupanteExterno() {
    const nome = document.getElementById('nomeOcupanteExterno').value.trim().toUpperCase();
    const rgCpf = document.getElementById('rgOcupanteExterno').value.trim();

    if (!nome || !rgCpf) {
      mostrarMensagem('Informe o nome e o documento do ocupante externo.', 'erro');
      return;
    }

    const participante = {
      origem: 'Manual',
      Nome: nome,
      RG_CPF: rgCpf,
      Tipo_Pessoa: 'Militar externo'
    };
    participante.chaveLista = criarChaveParticipanteViatura(participante);

    const chaveCondutor = pessoaSelecionada
      ? criarChaveParticipanteViatura(pessoaSelecionada)
      : criarChaveParticipanteViatura({
          RG_CPF: document.getElementById('rgCondutorExterno').value.trim()
        });

    if (chaveCondutor && chaveCondutor === participante.chaveLista) {
      mostrarMensagem('O condutor nÃ£o pode ser adicionado tambÃ©m como ocupante.', 'erro');
      return;
    }

    if (ocupantesViatura.some(item => item.chaveLista === participante.chaveLista)) {
      mostrarMensagem('Este militar jÃ¡ estÃ¡ na lista de ocupantes.', 'erro');
      return;
    }

    ocupantesViatura.push(participante);
    document.getElementById('nomeOcupanteExterno').value = '';
    document.getElementById('rgOcupanteExterno').value = '';
    renderizarOcupantesViatura();
    document.getElementById('nomeOcupanteExterno').focus();
  }

  function criarChaveParticipanteViatura(pessoa) {
    const documento = String((pessoa && pessoa.RG_CPF) || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (documento) {
      return 'DOC:' + documento;
    }

    const id = String((pessoa && pessoa.ID_Pessoa) || '').trim();
    return id ? 'ID:' + id : '';
  }

  function removerOcupanteViatura(chaveLista) {
    ocupantesViatura = ocupantesViatura.filter(item => item.chaveLista !== chaveLista);
    renderizarOcupantesViatura();
  }

  functi…3163 tokens truncated…” RG ${g.RG_Guarda}</strong><br><br>
            Deseja encerrar a sessÃ£o anterior e assumir a Guarda neste celular?`,
            () => assumirGuarda(true),
            true
          );

          return;
        }

        mostrarMensagem(resposta.mensagem || 'Guarda assumida com sucesso.', 'sucesso');

        if (resposta && resposta.guarda) {
          guardaAtual = resposta.guarda;

          // Autoriza o celular pessoal usado pelo guarda durante este serviÃ§o.
          salvarGuardaLocal(resposta.guarda);

          atualizarTelaGuarda();
        }

        limparAreaGuarda();
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao assumir Guarda: ' + erro.message, 'erro');

        botao.disabled = false;
        botao.textContent = 'Assumir neste celular';
      })
      .assumirGuardaComEmailValidado(dados);
  }

  function encerrarGuarda() {
    abrirModalConfirmacao(
      'Encerrar Guarda',
      'Para encerrar a Guarda, serÃ¡ enviado um cÃ³digo para o e-mail do guarda atual.<br><br>Deseja enviar o cÃ³digo?',
      () => enviarCodigoParaEncerrarGuarda(),
      true
    );
  }

  function executarEncerramentoGuarda() {
    const botao = document.getElementById('btnEncerrarGuarda');
    botao.disabled = true;
    botao.textContent = 'Saindo...';

    google.script.run
      .withSuccessHandler((resposta) => {
        mostrarMensagem(resposta.mensagem || 'Guarda encerrada com sucesso.', 'sucesso');

        guardaAtual = null;
        limparGuardaLocal();

        limparAreaGuarda();
        atualizarTelaGuarda();

        botao.disabled = false;
        botao.textContent = 'Sair';
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao encerrar Guarda: ' + erro.message, 'erro');

        botao.disabled = false;
        botao.textContent = 'Sair';
      })
      .encerrarGuardaAtivo();
  }

  function limparAreaGuarda() {
    limparCodigoGuardaPendente();

    dadosCodigoGuarda = null;
    emailEncerramentoGuarda = null;

    const camposParaLimpar = [
      'emailGuarda',
      'codigoGuarda',
      'rgGuardaManual',
      'nomeGuardaManual',
      'codigoEncerrarGuarda'
    ];

    camposParaLimpar.forEach(id => {
      const campo = document.getElementById(id);
      if (campo) {
        campo.value = '';
      }
    });

    const areasParaOcultar = [
      'areaCodigoEncerrarGuarda',
      'areaCodigoGuarda',
      'areaMilitarIdentificado',
      'areaIdentificacaoManual',
      'btnAssumirGuarda'
    ];

    areasParaOcultar.forEach(id => {
      const elemento = document.getElementById(id);
      if (elemento) {
        elemento.classList.add('oculto');
      }
    });

    const areaMilitar = document.getElementById('areaMilitarIdentificado');
    if (areaMilitar) {
      areaMilitar.innerHTML = '';
    }
  }

  function salvarCodigoGuardaPendente(email) {
    localStorage.setItem('guarda_email_pendente', email);
    localStorage.setItem('guarda_codigo_pendente_em', new Date().toISOString());
  }

  function limparCodigoGuardaPendente() {
    localStorage.removeItem('guarda_email_pendente');
    localStorage.removeItem('guarda_codigo_pendente_em');
  }

  function restaurarCodigoGuardaPendente() {
    const email = localStorage.getItem('guarda_email_pendente');
    const geradoEm = localStorage.getItem('guarda_codigo_pendente_em');

    if (!email || !geradoEm) {
      return;
    }

    const agora = new Date();
    const dataGerado = new Date(geradoEm);
    const diferencaMinutos = (agora - dataGerado) / 1000 / 60;

    if (diferencaMinutos > 10) {
      limparCodigoGuardaPendente();
      return;
    }

    document.getElementById('emailGuarda').value = email;
    document.getElementById('areaCodigoGuarda').classList.remove('oculto');

    dadosCodigoGuarda = {
      email: email,
      encontradoNoEfetivo: false,
      militar: null
    };

    mostrarMensagem('CÃ³digo pendente restaurado. Digite o cÃ³digo recebido por e-mail.', 'sucesso');
  }

function aplicarCodigoDoLink() {
  const email = window.PARAM_EMAIL_GUARDA || '';
  const codigo = window.PARAM_CODIGO_GUARDA || '';
  const perfil = String(window.PARAM_PERFIL || '').toLowerCase();

  if (!email || !codigo) {
    return;
  }

  if (perfil === 'comandante') {
    document.getElementById('emailComandante').value = email;
    document.getElementById('codigoComandante').value = codigo;
    document.getElementById('areaCodigoComandante').classList.remove('oculto');

    dadosCodigoComandante = {
      email: email,
      militar: null
    };

    mostrarMensagem('CÃ³digo do comandante recebido pelo link. Validando...', 'sucesso');
    setTimeout(() => validarCodigoComandante(), 500);
    return;
  }

  document.getElementById('emailGuarda').value = email;
  document.getElementById('codigoGuarda').value = codigo;
  document.getElementById('areaCodigoGuarda').classList.remove('oculto');

  dadosCodigoGuarda = {
    email: email,
    encontradoNoEfetivo: false,
    militar: null
  };

  mostrarMensagem('CÃ³digo recebido pelo link. Validando...', 'sucesso');

  setTimeout(() => {
    validarCodigoGuarda();
  }, 500);
}

function carregarComandanteAtivo() {
  google.script.run
    .withSuccessHandler((comandante) => {
      comandanteAtual = comandante;
      atualizarTelaComandante();
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao carregar comandante: ' + erro.message, 'erro');
    })
    .getComandanteAtivo();
}

function atualizarTelaComandante() {
  const status = document.getElementById('statusComandante');
  const areaAssumir = document.getElementById('areaAssumirComandante');
  const btnEncerrar = document.getElementById('btnEncerrarComandante');
  const btnTrocar = document.getElementById('btnTrocarComandante');

  status.classList.remove('sem-guarda', 'com-guarda');

  if (comandanteAtual) {
    const esteAparelhoAssumiu = aparelhoAssumiuComandanteAtual();

    status.classList.add('com-guarda');
    status.innerHTML = `
      Comandante atual:<br>
      ${comandanteAtual.Nome_Comandante} â€” RG ${comandanteAtual.RG_Comandante}
    `;

    areaAssumir.classList.add('oculto');
    btnEncerrar.classList.toggle('oculto', !esteAparelhoAssumiu);
    btnTrocar.classList.toggle('oculto', esteAparelhoAssumiu);
  } else {
    status.classList.add('sem-guarda');
    status.textContent = 'Nenhum Comandante da Guarda ativo. Valide seu e-mail para assumir neste celular.';
    areaAssumir.classList.remove('oculto');
    btnEncerrar.classList.add('oculto');
    btnTrocar.classList.add('oculto');
    limparComandanteLocal();
  }
}

function mostrarAreaTrocaComandante() {
  document.getElementById('areaAssumirComandante').classList.remove('oculto');
  mostrarMensagem(
    'Informe seu e-mail cadastrado para assumir como Comandante da Guarda. A sessÃ£o anterior do comandante serÃ¡ encerrada apÃ³s a confirmaÃ§Ã£o.',
    'sucesso'
  );
}

function enviarCodigoComandante() {
  const email = document.getElementById('emailComandante').value.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    mostrarMensagem('Informe um e-mail vÃ¡lido.', 'erro');
    return;
  }

  google.script.run
    .withSuccessHandler((resposta) => {
      dadosCodigoComandante = {
        email: resposta.email,
        militar: resposta.militar || null,
        ticketAssuncao: ''
      };

      salvarCodigoComandantePendente(resposta.email);
      document.getElementById('areaCodigoComandante').classList.remove('oculto');
      mostrarMensagem('CÃ³digo enviado ao e-mail cadastrado do comandante.', 'sucesso');
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao enviar cÃ³digo do comandante: ' + erro.message, 'erro');
    })
    .enviarCodigoAssumirComandante(email);
}

function validarCodigoComandante() {
  const email = document.getElementById('emailComandante').value.trim().toLowerCase();
  const codigo = document.getElementById('codigoComandante').value.trim();

  if (!email || !codigo) {
    mostrarMensagem('Informe o e-mail e o cÃ³digo do comandante.', 'erro');
    return;
  }

  google.script.run
    .withSuccessHandler((resposta) => {
      dadosCodigoComandante = {
        email: resposta.email,
        militar: resposta.militar || null,
        ticketAssuncao: resposta.ticketAssuncao || ''
      };

      limparCodigoComandantePendente();

      const area = document.getElementById('areaComandanteIdentificado');
      area.classList.remove('oculto', 'erro');
      area.innerHTML = `
        E-mail validado.<br>
        Militar identificado:<br>
        ${resposta.militar.Nome} â€” RG ${resposta.militar.RG}
      `;

      document.getElementById('btnAssumirComandante').classList.remove('oculto');
      mostrarMensagem('Comandante identificado com sucesso.', 'sucesso');
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao validar comandante: ' + erro.message, 'erro');
    })
    .validarCodigoAssumirComandante(email, codigo);
}

function assumirComandante(encerrarAnterior = false) {
  if (!dadosCodigoComandante || !dadosCodigoComandante.militar) {
    mostrarMensagem('Valide o e-mail antes de assumir como comandante.', 'erro');
    return;
  }

  const botao = document.getElementById('btnAssumirComandante');
  botao.disabled = true;
  botao.textContent = 'Assumindo...';

  google.script.run
    .withSuccessHandler((resposta) => {
      botao.disabled = false;
      botao.textContent = 'Assumir como comandante';

      if (resposta && resposta.requerConfirmacaoTroca && resposta.comandanteAtivo) {
        const comandante = resposta.comandanteAtivo;

        abrirModalConfirmacao(
          'Comandante jÃ¡ assumido',
          `JÃ¡ existe um Comandante da Guarda ativo:<br><br>
          <strong>${comandante.Nome_Comandante} â€” RG ${comandante.RG_Comandante}</strong><br><br>
          Deseja encerrar somente a sessÃ£o do comandante anterior e assumir neste celular?`,
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
    'SerÃ¡ enviado um cÃ³digo para o e-mail do comandante atual.<br><br>Deseja continuar?',
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
      mostrarMensagem('CÃ³digo enviado ao e-mail do comandante atual.', 'sucesso');
      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao enviar cÃ³digo do comandante: ' + erro.message, 'erro');
      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .enviarCodigoEncerrarComandante();
}

function validarCodigoEEncerrarComandante() {
  const codigo = document.getElementById('codigoEncerrarComandante').value.trim();

  if (!emailEncerramentoComandante || !codigo) {
    mostrarMensagem('Informe o cÃ³digo enviado ao comandante atual.', 'erro');
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
        'CÃ³digo enviado para o e-mail do guarda atual. Informe o cÃ³digo para encerrar.',
        'sucesso'
      );

      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .withFailureHandler((erro) => {
      mostrarMensagem('Erro ao enviar cÃ³digo: ' + erro.message, 'erro');

      botao.disabled = false;
      botao.textContent = 'Sair';
    })
    .enviarCodigoEncerrarGuarda();
}

function validarCodigoEEncerrarGuarda() {
  const codigo = document.getElementById('codigoEncerrarGuarda').value.trim();

  if (!emailEncerramentoGuarda || !codigo) {
    mostrarMensagem('Informe o cÃ³digo enviado ao guarda atual.', 'erro');
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

function atualizarPermissaoLancamento() {
  const cardMovimentacao = document.getElementById('cardMovimentacao');
  const aviso = document.getElementById('avisoSemPermissaoLancamento');

  if (!cardMovimentacao || !aviso) {
    return;
  }

  const podeLancar = guardaAtual && aparelhoAssumiuGuardaAtual();

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
