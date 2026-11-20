(() => {
  const invoke = window.__TAURI__?.core?.invoke;
  const $ = (id) => document.getElementById(id);
  const state = { installed: [], releases: [], preferred: null, latest: null, latestDefault: true, launcherUpdate: null };
  const message = (text, error = false) => {
    $('message').textContent = text;
    $('message').classList.toggle('error', error);
  };
  const compareVersions = (a, b) => {
    const parse = (value) => value.split(/[.+-]/).map(part => /^\d+$/.test(part) ? Number(part) : part);
    const aa = parse(a), bb = parse(b);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
      const x = aa[i] ?? 0, y = bb[i] ?? 0;
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return String(x).localeCompare(String(y), undefined, { numeric: true });
    }
    return 0;
  };
  const latestInstalled = () => state.installed.slice().sort((a,b) => compareVersions(b.version,a.version))[0]?.version ?? null;
  const latestRelease = () => state.releases.slice().sort((a,b) => compareVersions(b.version,a.version))[0]?.version ?? null;
  const selectedVersion = () => $('version-select').value;
  const isInstalled = (version) => state.installed.some(item => item.version === version);
  const findRelease = (version) => state.releases.find(item => item.version === version);
  const updateLatestBadge = () => {
    $('latest-release').textContent = state.latest ? 'v' + state.latest : 'SEM RELEASE';
    const installed = Boolean(state.latest && isInstalled(state.latest));
    $('latest-status').textContent = !state.latest
      ? 'VERSÃO NÃO PUBLICADA'
      : installed ? 'JOGO ATUALIZADO' : 'NOVA VERSÃO DISPONÍVEL';
  };
  const updateMain = () => {
    const selected = state.latestDefault
      ? (state.latest && isInstalled(state.latest) ? state.latest : latestInstalled())
      : (state.preferred && isInstalled(state.preferred) ? state.preferred : latestInstalled());
    $('current-version').textContent = selected ? 'v' + selected : 'NOT INSTALLED';
    $('play').disabled = !selected;
    updateLatestBadge();
  };
  const updateSelectionActions = () => {
    const version = selectedVersion();
    const installed = Boolean(version) && isInstalled(version);
    const available = Boolean(version) && Boolean(findRelease(version));
    $('save-version').disabled = !installed;
    $('install').disabled = !available || installed;
    $('install').textContent = installed ? 'VERSÃO JÁ INSTALADA' : 'INSTALAR VERSÃO SELECIONADA';
  };
  const renderVersions = (preferredSelection = '') => {
    const select = $('version-select');
    const previous = preferredSelection || select.value;
    const versions = new Map();
    for (const item of state.releases) versions.set(item.version, { version: item.version, release: true });
    for (const item of state.installed) {
      const existing = versions.get(item.version) || { version: item.version, release: false };
      existing.installed = true;
      versions.set(item.version, existing);
    }
    select.replaceChildren();
    const sorted = [...versions.values()].sort((a,b) => compareVersions(b.version,a.version));
    if (!sorted.length) select.add(new Option('Nenhuma versão disponível', ''));
    for (const item of sorted) {
      const status = item.installed ? ' · instalada' : ' · disponível para instalar';
      select.add(new Option('v' + item.version + status, item.version));
    }
    const fallback = state.latestDefault
      ? (state.latest || latestInstalled())
      : (state.preferred || latestInstalled());
    select.value = sorted.some(item => item.version === previous) ? previous : (sorted.some(item => item.version === fallback) ? fallback : (sorted[0]?.version ?? ''));
    updateSelectionActions();
  };

  const checkLauncherUpdate = async () => {
    const status = $('launcher-update-status');
    const button = $('launcher-update');
    button.disabled = true;
    status.classList.remove('available', 'error');
    status.textContent = 'Verificando atualização do launcher…';
    try {
      const current = await invoke('get_launcher_version');
      $('launcher-version').textContent = 'v' + current;
      state.launcherUpdate = await invoke('check_launcher_update');
      if (state.launcherUpdate) {
        status.classList.add('available');
        status.textContent = 'Nova versão v' + state.launcherUpdate.version + ' disponível (' + state.launcherUpdate.packageKind + ').';
        $('settings-toggle').classList.add('update-available');
        button.disabled = false;
      } else {
        $('settings-toggle').classList.remove('update-available');
        status.textContent = 'Launcher atualizado · v' + current;
      }
    } catch (error) {
      state.launcherUpdate = null;
      $('settings-toggle').classList.remove('update-available');
      status.classList.add('error');
      status.textContent = 'Não foi possível verificar: ' + String(error);
    }
  };
  const refreshInstalled = async () => {
    state.installed = await invoke('list_installed_versions');
    state.preferred = await invoke('get_preferred_version');
    renderVersions();
    updateMain();
  };
  const refreshManifest = async () => {
    if (!invoke) { message('Abra este aplicativo pelo launcher instalado.', true); return; }
    $('refresh').disabled = true;
    $('connection').textContent = 'Verificando atualizações…';
    try {
      const manifest = await invoke('fetch_manifest');
      state.releases = Array.isArray(manifest.versions) ? manifest.versions : [];
      state.latest = manifest.latest_version || latestRelease();
      updateLatestBadge();
      renderVersions(state.latestDefault && state.latest ? state.latest : '');
      const installedSet = new Set(state.installed.map(item => item.version));
      $('connection').textContent = state.latest
        ? (installedSet.has(state.latest) ? 'Atualizado · v' + state.latest : 'Nova versão disponível · v' + state.latest)
        : 'Nenhuma versão publicada no manifesto';
      updateMain();
      if (!state.launcherUpdate) {
        if (!state.latest) message('Nenhuma versão do jogo foi publicada ainda.');
        else if (!installedSet.has(state.latest)) message('Há ' + state.releases.length + ' versão(ões) disponível(is). Selecione qualquer uma nas configurações para instalar.');
        else message('Jogo na versão mais recente.');
      }
    } catch (error) {
      $('connection').textContent = 'Não foi possível verificar';
      message('Falha ao verificar atualizações: ' + String(error), true);
    } finally { $('refresh').disabled = false; }
  };

  $('launcher-update').addEventListener('click', async () => {
    const update = state.launcherUpdate;
    if (!update) return;
    const confirmed = window.confirm(
      'Instalar o Launcher v' + update.version + ' agora? O aplicativo será reiniciado.\n\n' +
      (update.packageKind === 'deb'
        ? 'O sistema solicitará sua senha para instalar o pacote .deb.'
        : 'O AppImage atual será substituído pelo arquivo verificado.')
    );
    if (!confirmed) return;
    $('launcher-update').disabled = true;
    $('launcher-update-status').textContent = 'Baixando, verificando SHA-256 e instalando…';
    try {
      await invoke('install_launcher_update');
    } catch (error) {
      $('launcher-update').disabled = false;
      $('launcher-update-status').classList.add('error');
      $('launcher-update-status').textContent = 'Falha na atualização: ' + String(error);
    }
  });
  $('settings-toggle').addEventListener('click', () => {
    const open = $('settings-panel').classList.toggle('open');
    $('settings-toggle').setAttribute('aria-expanded', String(open));
  });
  $('settings-close').addEventListener('click', () => {
    $('settings-panel').classList.remove('open');
    $('settings-toggle').setAttribute('aria-expanded', 'false');
  });
  const defaultWallpaper = './images/wallpaper_launcher_cidade_noite_1920x1080.png';
  const wallpaperKey = 'oz-launcher-wallpaper-v1';
  const applyWallpaper = (source) => { $('wallpaper-image').src = source || defaultWallpaper; };
  try {
    const savedWallpaper = localStorage.getItem(wallpaperKey);
    if (savedWallpaper?.startsWith('data:image/')) applyWallpaper(savedWallpaper);
  } catch (error) {
    console.warn('[Launcher] Não foi possível recuperar o wallpaper personalizado.', error);
  }
  $('choose-wallpaper').addEventListener('click', () => $('wallpaper-file').click());
  $('wallpaper-file').addEventListener('change', () => {
    const file = $('wallpaper-file').files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      message('Formato inválido. Use PNG, JPG ou WebP.', true);
      $('wallpaper-file').value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      message('A imagem deve ter no máximo 4 MB.', true);
      $('wallpaper-file').value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
        message('Não foi possível carregar a imagem selecionada.', true);
        return;
      }
      try {
        localStorage.setItem(wallpaperKey, reader.result);
        applyWallpaper(reader.result);
        message('Wallpaper personalizado aplicado.');
      } catch (error) {
        message('Não foi possível salvar o wallpaper. Escolha uma imagem menor.', true);
      }
    };
    reader.onerror = () => message('Falha ao ler a imagem selecionada.', true);
    reader.readAsDataURL(file);
    $('wallpaper-file').value = '';
  });
  $('reset-wallpaper').addEventListener('click', () => {
    try {
      localStorage.removeItem(wallpaperKey);
      applyWallpaper(defaultWallpaper);
      message('Wallpaper padrão restaurado.');
    } catch (error) {
      message('Não foi possível restaurar o wallpaper padrão.', true);
    }
  });
  $('latest-default').addEventListener('change', () => {
    state.latestDefault = $('latest-default').checked;
    localStorage.setItem('oz-latest-default', String(state.latestDefault));
    renderVersions(state.latestDefault ? (state.latest || '') : (state.preferred || ''));
    updateMain();
  });
  $('version-select').addEventListener('change', updateSelectionActions);
  $('save-version').addEventListener('click', async () => {
    const version = selectedVersion();
    if (!version || !isInstalled(version)) return;
    try {
      await invoke('set_preferred_version', { version });
      state.preferred = version;
      state.latestDefault = false;
      $('latest-default').checked = false;
      localStorage.setItem('oz-latest-default', 'false');
      updateMain();
      message('Versão v' + version + ' selecionada para iniciar.');
    } catch (error) { message(String(error), true); }
  });
  $('refresh').addEventListener('click', async () => {
    try { await refreshInstalled(); await Promise.all([refreshManifest(), checkLauncherUpdate()]); }
    catch (error) { message(String(error), true); }
  });
  $('install').addEventListener('click', async () => {
    const version = selectedVersion();
    if (!version || !findRelease(version) || isInstalled(version)) return;
    if (!window.confirm('Baixar e instalar Outbreak Zones v' + version + '?')) return;
    $('install').disabled = true;
    message('Baixando e verificando v' + version + '…');
    try {
      await invoke('download_game_version', { version });
      await refreshInstalled();
      $('version-select').value = version;
      updateSelectionActions();
      $('connection').textContent = 'Versão v' + version + ' instalada';
      message('Versão v' + version + ' instalada. Clique em Aplicar versão para defini-la como padrão.');
    } catch (error) { message('Não foi possível instalar: ' + String(error), true); }
    finally { updateSelectionActions(); }
  });
  $('play').addEventListener('click', async () => {
    const version = $('current-version').textContent.replace(/^v/, '');
    if (!version || version === 'NOT INSTALLED' || !isInstalled(version)) return;
    $('play').disabled = true;
    message('Iniciando o jogo…');
    try {
      await invoke('set_preferred_version', { version });
      await invoke('launch_game', { version });
    } catch (error) {
      $('play').disabled = false;
      message('Não foi possível iniciar o jogo: ' + String(error), true);
    }
  });
  (async () => {
    if (!invoke) { message('Abra este aplicativo pelo launcher instalado.', true); return; }
    state.latestDefault = localStorage.getItem('oz-latest-default') !== 'false';
    $('latest-default').checked = state.latestDefault;
    try { await refreshInstalled(); await refreshManifest(); await checkLauncherUpdate(); }
    catch (error) { message(String(error), true); }
  })();
})();