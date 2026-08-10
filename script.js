const URL_API = 'https://script.google.com/macros/s/AKfycbwqSpqWQOjFcOfSClEGTesKZAGPnuMaKQiIIu9RYChC5yFX6gwXpwFg1f5DpvbNHy5j/exec';
const parametrosUrl = new URLSearchParams(window.location.search);

window.PARAM_EMAIL_GUARDA = parametrosUrl.get('email') || '';
window.PARAM_CODIGO_GUARDA = parametrosUrl.get('codigo') || '';

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

function montarDadosChamadaApi(nome, argumentos) {
  const sessaoToken = obterSessaoTokenLocal();

  switch (nome) {
    case 'getListasFormulario':
      return {};
    case 'getGuardaAtivo':
      return { sessaoToken: sessaoToken };
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

  if (
    nome === 'assumirGuardaComEmailValidado' &&
    resposta &&
    resposta.guarda &&
    resposta.sessaoToken
  ) {
    resposta.guarda.Sessao_Valida = true;
    resposta.guarda.Sessao_Token = resposta.sessaoToken;
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
    'buscarPessoasPorRgCpf',
    'registrarMovimentacao',
    'enviarCodigoAssumirGuarda',
    'validarCodigoAssumirGuarda',
    'assumirGuardaComEmailValidado',
    'enviarCodigoEncerrarGuarda',
    'validarCodigoEEncerrarGuarda'
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


  document.addEventListener('DOMContentLoaded', () => {
    carregarListas();
    selecionarModoRegistro('Individual');
    alternarTipoRegistro();
    carregarGuardaAtivo();
    restaurarCodigoGuardaPendente();
    aplicarCodigoDoLink();
  });

  function selecionarMovimentacao(tipo) {
    tipoMovimentacaoAtual = tipo;

    document.getElementById('btnEntrada').classList.toggle('ativo', tipo === 'Entrada');
    document.getElementById('btnSaida').classList.toggle('ativo', tipo === 'Saída');

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
      ? 'Obrigatório'
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
      option.value = item.Procedência;
      option.textContent = item.Procedência;
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
      label.textContent = 'Complemento da procedência';
    }
  }

  function buscarPessoa() {
    const rgCpf = document.getElementById('rgCpfBusca').value.trim();

    if (!rgCpf || rgCpf.replace(/\D/g, '').length < 3) {
      mostrarMensagem('Digite pelo menos 3 dígitos do RG/CPF.', 'erro');
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
          item.textContent = `${pessoa.Nome} — ${pessoa.RG_CPF}`;
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
      mostrarMensagem('Este militar já foi adicionado como ocupante.', 'erro');
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
        Selecionado: ${pessoa.Nome} — ${pessoa.RG_CPF}
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
      mostrarMensagem('Digite pelo menos 3 dígitos do RG/CPF do ocupante.', 'erro');
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
          item.textContent = `${pessoa.Nome} — ${pessoa.RG_CPF}`;
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
      mostrarMensagem('O condutor não pode ser adicionado também como ocupante.', 'erro');
      return;
    }

    if (ocupantesViatura.some(item => item.chaveLista === participante.chaveLista)) {
      mostrarMensagem('Este militar já está na lista de ocupantes.', 'erro');
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
      mostrarMensagem('O condutor não pode ser adicionado também como ocupante.', 'erro');
      return;
    }

    if (ocupantesViatura.some(item => item.chaveLista === participante.chaveLista)) {
      mostrarMensagem('Este militar já está na lista de ocupantes.', 'erro');
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

  function renderizarOcupantesViatura() {
    const lista = document.getElementById('listaOcupantesViatura');
    const contador = document.getElementById('contadorOcupantesViatura');

    const quantidade = ocupantesViatura.length;
    contador.textContent = quantidade === 1 ? '1 pessoa' : `${quantidade} pessoas`;
    lista.innerHTML = '';
    lista.classList.toggle('oculto', ocupantesViatura.length === 0);

    ocupantesViatura.forEach(pessoa => {
      const item = document.createElement('div');
      item.className = 'ocupante-viatura';

      const identificacao = document.createElement('div');
      const nome = document.createElement('strong');
      const documento = document.createElement('span');
      const origem = document.createElement('small');
      nome.textContent = pessoa.Nome;
      documento.textContent = pessoa.RG_CPF;
      origem.textContent = String(pessoa.origem || '').toLowerCase() === 'manual'
        ? 'Não cadastrado'
        : 'Cadastrado';
      identificacao.appendChild(nome);
      identificacao.appendChild(documento);
      identificacao.appendChild(origem);
      item.appendChild(identificacao);

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.textContent = 'Remover';
      remover.onclick = () => removerOcupanteViatura(pessoa.chaveLista);
      item.appendChild(remover);
      lista.appendChild(item);
    });
  }

  function registrarMovimentacao() {
    const tipoRegistro = document.getElementById('tipoRegistro').value;

    const dados = {
      modoRegistro: modoRegistroAtual,
      tipoMovimentacao: tipoMovimentacaoAtual,
      tipoRegistro: tipoRegistro,
      pessoaCadastrada: pessoaSelecionada,
      condutorExterno: condutorExternoAtivo ? {
        origem: 'Manual',
        Nome: document.getElementById('nomeCondutorExterno').value.trim(),
        RG_CPF: document.getElementById('rgCondutorExterno').value.trim()
      } : null,
      nomeVisitante: document.getElementById('nomeVisitante').value.trim(),
      rgCpfVisitante: document.getElementById('rgCpfVisitante').value.trim(),
      destino: document.getElementById('destino').value,
      procedencia: document.getElementById('procedencia').value,
      complementoProcedencia: document.getElementById('complementoProcedencia').value.trim(),
      prefixoPlaca: document.getElementById('prefixoPlaca').value.replace(/\s+/g, '').toUpperCase(),
      observacoes: document.getElementById('observacoes').value.trim(),
      ocupantesViatura: ocupantesViatura
    };

    if (modoRegistroAtual === 'Viatura') {
      if (!pessoaSelecionada && !condutorExternoAtivo) {
        mostrarMensagem('Selecione um condutor cadastrado ou informe um condutor externo.', 'erro');
        return;
      }

      if (
        condutorExternoAtivo &&
        (!dados.condutorExterno.Nome || !dados.condutorExterno.RG_CPF)
      ) {
        mostrarMensagem('Informe o nome e o documento do condutor externo.', 'erro');
        return;
      }

      if (!dados.prefixoPlaca) {
        mostrarMensagem('Informe o prefixo ou a placa da viatura.', 'erro');
        return;
      }

      if (ocupantesViatura.length === 0) {
        mostrarMensagem('Adicione ao menos um ocupante da viatura.', 'erro');
        return;
      }
    }

    if (tipoRegistro === 'Pessoa cadastrada' && !pessoaSelecionada) {
      mostrarMensagem('Busque e selecione uma pessoa cadastrada antes de registrar.', 'erro');
      return;
    }

    if (tipoRegistro === 'Visitante eventual') {
      if (!dados.nomeVisitante) {
        mostrarMensagem('Informe o nome do visitante.', 'erro');
        return;
      }

      if (!dados.rgCpfVisitante) {
        mostrarMensagem('Informe o RG/CPF do visitante.', 'erro');
        return;
      }
    }

    const areaComplemento = document.getElementById('areaComplementoProcedencia');
    const complementoVisivel = !areaComplemento.classList.contains('oculto');

    if (complementoVisivel && !dados.complementoProcedencia) {
      mostrarMensagem('Informe o complemento da procedência.', 'erro');
      return;
    }

    const botao = document.getElementById('btnRegistrarMovimentacao');
    botao.disabled = true;
    botao.textContent = 'Registrando...';

    google.script.run
      .withSuccessHandler((resposta) => {
        mostrarMensagem(resposta.mensagem || 'Movimentação registrada com sucesso.', 'sucesso');
        limparFormulario();

        botao.disabled = false;
        botao.textContent = modoRegistroAtual === 'Viatura' ? 'Registrar viatura' : 'Registrar';
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao registrar movimentação: ' + erro.message, 'erro');

        botao.disabled = false;
        botao.textContent = modoRegistroAtual === 'Viatura' ? 'Registrar viatura' : 'Registrar';
      })
      .registrarMovimentacao(dados);
  }

  function limparFormulario() {
    pessoaSelecionada = null;
    condutorExternoAtivo = false;
    ocupantesViatura = [];

    document.getElementById('rgCpfBusca').value = '';
    document.getElementById('resultadoPessoa').innerHTML = '';
    document.getElementById('resultadoPessoa').classList.add('oculto');

    document.getElementById('nomeVisitante').value = '';
    document.getElementById('rgCpfVisitante').value = '';

    document.getElementById('complementoProcedencia').value = '';
    document.getElementById('prefixoPlaca').value = '';
    document.getElementById('observacoes').value = '';
    document.getElementById('rgCpfBuscaOcupante').value = '';
    document.getElementById('resultadoOcupanteViatura').innerHTML = '';
    document.getElementById('resultadoOcupanteViatura').classList.add('oculto');
    document.getElementById('nomeCondutorExterno').value = '';
    document.getElementById('rgCondutorExterno').value = '';
    document.getElementById('nomeOcupanteExterno').value = '';
    document.getElementById('rgOcupanteExterno').value = '';
    document.getElementById('areaOcupanteExterno').classList.add('oculto');
    renderizarOcupantesViatura();

    document.getElementById('tipoRegistro').value = 'Pessoa cadastrada';
    selecionarModoRegistro('Individual');
  }

  function mostrarMensagem(texto, tipo = 'sucesso') {
    const mensagem = document.getElementById('mensagemSistema');

    if (!mensagem) {
      console.log(texto);
      return;
    }

    mensagem.textContent = texto;
    mensagem.classList.remove('oculto', 'sucesso', 'erro');
    mensagem.classList.add(tipo);

    setTimeout(() => {
      mensagem.classList.add('oculto');
    }, 3500);
  }

  function carregarGuardaAtivo() {
    google.script.run
      .withSuccessHandler((guarda) => {
        guardaAtual = guarda;
        atualizarTelaGuarda();
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao carregar guarda: ' + erro.message, 'erro');
      })
      .getGuardaAtivo();
  }

  function atualizarTelaGuarda() {
    const status = document.getElementById('statusGuarda');
    const areaAssumir = document.getElementById('areaAssumirGuarda');
    const btnEncerrar = document.getElementById('btnEncerrarGuarda');
    const btnTrocar = document.getElementById('btnTrocarGuarda');

    status.classList.remove('sem-guarda', 'com-guarda');

    if (guardaAtual) {
      const esteAparelhoAssumiu = aparelhoAssumiuGuardaAtual();

      status.classList.add('com-guarda');
      status.innerHTML = `
        Guarda atual:<br>
        ${guardaAtual.Nome_Guarda} — RG ${guardaAtual.RG_Guarda}
      `;

      areaAssumir.classList.add('oculto');

      if (btnEncerrar) {
        btnEncerrar.classList.toggle('oculto', !esteAparelhoAssumiu);
      }

      if (btnTrocar) {
        btnTrocar.classList.toggle('oculto', esteAparelhoAssumiu);
      }

    } else {
      status.classList.add('sem-guarda');
      status.textContent = 'Nenhum guarda ativo. Valide seu e-mail para assumir a Guarda neste celular.';

      areaAssumir.classList.remove('oculto');

      if (btnEncerrar) {
        btnEncerrar.classList.add('oculto');
      }

      if (btnTrocar) {
        btnTrocar.classList.add('oculto');
      }

      limparGuardaLocal();
    }

    atualizarPermissaoLancamento();
  }

  function mostrarAreaTrocaGuarda() {
    document.getElementById('areaAssumirGuarda').classList.remove('oculto');
    mostrarMensagem('Informe seu e-mail para assumir a Guarda neste celular. A sessão anterior será encerrada após a confirmação.', 'sucesso');
  }  

  function enviarCodigoGuarda() {
    const email = document.getElementById('emailGuarda').value.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      mostrarMensagem('Informe um e-mail válido.', 'erro');
      return;
    }

    google.script.run
      .withSuccessHandler((resposta) => {
        dadosCodigoGuarda = {
          email: resposta.email,
          encontradoNoEfetivo: resposta.encontradoNoEfetivo,
          militar: resposta.militar || null
        };

        salvarCodigoGuardaPendente(resposta.email);

        document.getElementById('areaCodigoGuarda').classList.remove('oculto');

        mostrarMensagem('Código enviado. Você pode abrir seu e-mail e voltar para informar o código.', 'sucesso');
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao enviar código: ' + erro.message, 'erro');
      })
      .enviarCodigoAssumirGuarda(email);
  }

  function validarCodigoGuarda() {
    const email = document.getElementById('emailGuarda').value.trim().toLowerCase();
    const codigo = document.getElementById('codigoGuarda').value.trim();

    if (!email || !codigo) {
      mostrarMensagem('Informe o e-mail e o código.', 'erro');
      return;
    }

    google.script.run
      .withSuccessHandler((resposta) => {
        dadosCodigoGuarda = {
          email: resposta.email,
          encontradoNoEfetivo: resposta.encontradoNoEfetivo,
          militar: resposta.militar || null,
          ticketAssuncao: resposta.ticketAssuncao || ''
        };

        limparCodigoGuardaPendente();

        const areaMilitar = document.getElementById('areaMilitarIdentificado');
        const areaManual = document.getElementById('areaIdentificacaoManual');
        const btnAssumir = document.getElementById('btnAssumirGuarda');

        areaMilitar.classList.remove('oculto', 'erro');
        btnAssumir.classList.remove('oculto');

        if (resposta.encontradoNoEfetivo && resposta.militar) {
          areaMilitar.innerHTML = `
            E-mail validado.<br>
            Militar identificado:<br>
            ${resposta.militar.Nome} — RG ${resposta.militar.RG}
          `;
          areaManual.classList.add('oculto');
        } else {
          areaMilitar.innerHTML = `
            E-mail validado, mas não localizado no efetivo.<br>
            Informe RG e nome do militar.
          `;
          areaManual.classList.remove('oculto');
        }

        mostrarMensagem('Código validado com sucesso.', 'sucesso');
      })
      .withFailureHandler((erro) => {
        mostrarMensagem('Erro ao validar código: ' + erro.message, 'erro');
      })
      .validarCodigoAssumirGuarda(email, codigo);
  }

  function assumirGuarda(encerrarAnterior = false) {
    if (!dadosCodigoGuarda) {
      mostrarMensagem('Valide o e-mail antes de assumir a Guarda.', 'erro');
      return;
    }

    const botao = document.getElementById('btnAssumirGuarda');
    botao.disabled = true;
    botao.textContent = 'Assumindo...';

    const dados = {
      email: dadosCodigoGuarda.email,
      origemIdentificacao: dadosCodigoGuarda.encontradoNoEfetivo ? 'Efetivo' : 'Manual',
      militar: dadosCodigoGuarda.militar,
      rgManual: document.getElementById('rgGuardaManual').value.trim(),
      nomeManual: document.getElementById('nomeGuardaManual').value.trim(),
      encerrarAnterior: encerrarAnterior,
      ticketAssuncao: dadosCodigoGuarda.ticketAssuncao || ''
    };

    google.script.run
      .withSuccessHandler((resposta) => {
        botao.disabled = false;
        botao.textContent = 'Assumir neste celular';

        if (resposta && resposta.requerConfirmacaoTroca && resposta.guardaAtivo) {
          const g = resposta.guardaAtivo;

          abrirModalConfirmacao(
            'Guarda já assumida',
            `Já existe um guarda ativo:<br><br>
            <strong>${g.Nome_Guarda} — RG ${g.RG_Guarda}</strong><br><br>
            Deseja encerrar a sessão anterior e assumir a Guarda neste celular?`,
            () => assumirGuarda(true),
            true
          );

          return;
        }

        mostrarMensagem(resposta.mensagem || 'Guarda assumida com sucesso.', 'sucesso');

        if (resposta && resposta.guarda) {
          guardaAtual = resposta.guarda;

          // Autoriza o celular pessoal usado pelo guarda durante este serviço.
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
      'Para encerrar a Guarda, será enviado um código para o e-mail do guarda atual.<br><br>Deseja enviar o código?',
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

    mostrarMensagem('Código pendente restaurado. Digite o código recebido por e-mail.', 'sucesso');
  }

  function aplicarCodigoDoLink() {
  const email = window.PARAM_EMAIL_GUARDA || '';
  const codigo = window.PARAM_CODIGO_GUARDA || '';

  if (!email || !codigo) {
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

  mostrarMensagem('Código recebido pelo link. Validando...', 'sucesso');

  setTimeout(() => {
    validarCodigoGuarda();
  }, 500);
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