(() => {
  const invoke = window.__TAURI__?.core?.invoke;
  const $ = (id) => document.getElementById(id);
  const state = { installed: [], releases: [], preferred: null, latest: null, latestDefault: true };
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
  const updateMain = () => {
    const selected = state.latestDefault ? (state.latest && state.installed.some(item => item.version === state.latest) ? state.latest : latestInstalled()) : (state.preferred && state.installed.some(item => item.version === state.preferred) ? state.preferred : latestInstalled());
    $('current-version').textContent = selected ? 'v' + selected : 'NOT INSTALLED';
    $('play').disabled = !selected;
    if (selected) $('version-select').value = selected;
  };
  const refreshInstalled = async () => {
    state.installed = await invoke('list_installed_versions');
    state.preferred = await invoke('get_preferred_version');
    const select = $('version-select');
    const previous = select.value;
    select.replaceChildren();
    if (!state.installed.length) select.add(new Option('Nenhuma versão instalada', ''));
    for (const item of state.installed.slice().sort((a,b) => compareVersions(b.version,a.version))) {
      select.add(new Option('v' + item.version + (item.version === state.preferred ? ' · salva' : ''), item.version));
    }
    const preferred = state.latestDefault
      ? (state.latest && state.installed.some(item => item.version === state.latest) ? state.latest : latestInstalled())
      : (state.preferred && state.installed.some(item => item.version === state.preferred) ? state.preferred : latestInstalled());
    select.value = previous && state.installed.some(item => item.version === previous) ? previous : (preferred ?? '');
    $('save-version').disabled = !select.value;
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
      const installedSet = new Set(state.installed.map(item => item.version));
      const releaseSelect = $('version-select');
      const current = releaseSelect.value;
      const available = state.releases.filter(item => !installedSet.has(item.version)).sort((a,b) => compareVersions(b.version,a.version));
      for (const item of state.releases) {
        if (!state.installed.some(installed => installed.version === item.version)) {
          // A versão publicada permanece selecionável para instalação, sem aparecer como instalada.
        }
      }
      $('install').disabled = !state.latest || installedSet.has(state.latest);
      $('install').textContent = state.latest && installedSet.has(state.latest) ? 'ÚLTIMA VERSÃO INSTALADA' : 'INSTALAR ÚLTIMA VERSÃO';
      $('connection').textContent = state.latest
        ? (installedSet.has(state.latest) ? 'Atualizado · v' + state.latest : 'Nova versão disponível · v' + state.latest)
        : 'Nenhuma versão publicada no manifesto';
      if (state.latestDefault && state.latest && installedSet.has(state.latest)) releaseSelect.value = state.latest;
      else if (current && state.installed.some(item => item.version === current)) releaseSelect.value = current;
      updateMain();
      if (!state.latest) message('Nenhuma versão do jogo foi publicada ainda.');
      else if (!installedSet.has(state.latest)) message('A versão mais recente é v' + state.latest + '. Abra as configurações para instalar.');
      else message('Launcher atualizado. Jogo na versão mais recente.');
    } catch (error) {
      $('connection').textContent = 'Não foi possível verificar';
      message('Falha ao verificar atualizações: ' + String(error), true);
    } finally { $('refresh').disabled = false; }
  };
  $('settings-toggle').addEventListener('click', () => $('settings-panel').classList.toggle('open'));
  $('settings-close').addEventListener('click', () => $('settings-panel').classList.remove('open'));
  $('latest-default').addEventListener('change', () => {
    state.latestDefault = $('latest-default').checked;
    localStorage.setItem('oz-latest-default', String(state.latestDefault));
    updateMain();
  });
  $('version-select').addEventListener('change', () => { $('save-version').disabled = !selectedVersion(); });
  $('save-version').addEventListener('click', async () => {
    const version = selectedVersion();
    if (!version) return;
    try {
      await invoke('set_preferred_version', { version });
      state.preferred = version;
      state.latestDefault = false;
      $('latest-default').checked = false;
      localStorage.setItem('oz-latest-default', 'false');
      updateMain();
      message('Versão v' + version + ' selecionada.');
    } catch (error) { message(String(error), true); }
  });
  $('refresh').addEventListener('click', async () => {
    try { await refreshInstalled(); await refreshManifest(); }
    catch (error) { message(String(error), true); }
  });
  $('install').addEventListener('click', async () => {
    if (!state.latest || $('install').disabled) return;
    if (!window.confirm('Baixar e instalar Outbreak Zones v' + state.latest + '?')) return;
    $('install').disabled = true;
    message('Baixando e verificando v' + state.latest + '…');
    try {
      await invoke('download_game_version', { version: state.latest });
      await refreshInstalled();
      if (state.latestDefault) $('version-select').value = state.latest;
      $('connection').textContent = 'Versão v' + state.latest + ' instalada';
      updateMain();
      message('Versão v' + state.latest + ' instalada com sucesso.');
    } catch (error) { message('Não foi possível instalar: ' + String(error), true); }
    finally { $('install').disabled = !state.latest || state.installed.some(item => item.version === state.latest); }
  });
  $('play').addEventListener('click', async () => {
    const version = $('current-version').textContent.replace(/^v/, '');
    if (!version || version === 'NOT INSTALLED') return;
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
    try { await refreshInstalled(); await refreshManifest(); }
    catch (error) { message(String(error), true); }
  })();
})();