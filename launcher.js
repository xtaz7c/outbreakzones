(() => {
  const invoke = window.__TAURI__?.core?.invoke;
  const $ = (id) => document.getElementById(id);
  const state = { installed: [], releases: [], preferred: null };
  const message = (text, error = false) => { $('message').textContent = text; $('message').style.color = error ? '#e58b83' : '#a8aca4'; };
  const setBusy = (busy) => { $('refresh').disabled = busy; $('install').disabled = busy || !$('release-select').value; };
  const refreshInstalled = async () => {
    state.installed = await invoke('list_installed_versions');
    state.preferred = await invoke('get_preferred_version');
    const select = $('version-select');
    select.replaceChildren();
    if (!state.installed.length) select.add(new Option('Nenhuma versão instalada', ''));
    for (const item of state.installed) select.add(new Option('v' + item.version + (item.version === state.preferred ? ' · padrão' : ''), item.version));
    if (state.preferred && state.installed.some(item => item.version === state.preferred)) select.value = state.preferred;
    else if (state.installed.length) select.value = state.installed[0].version;
    $('play').disabled = !select.value;
    $('save').disabled = !select.value;
  };
  const refreshManifest = async () => {
    if (!invoke) { message('Abra este aplicativo pelo launcher Tauri para gerenciar versões.', true); return; }
    setBusy(true);
    $('connection').textContent = 'Consultando…';
    try {
      const manifest = await invoke('fetch_manifest');
      state.releases = Array.isArray(manifest.versions) ? manifest.versions : [];
      $('latest').textContent = manifest.latest_version ? 'Mais recente: v' + manifest.latest_version : 'Nenhuma versão publicada';
      $('connection').textContent = 'Manifesto atualizado';
      const installedSet = new Set(state.installed.map(item => item.version));
      const available = state.releases.filter(item => !installedSet.has(item.version));
      const select = $('release-select');
      select.replaceChildren();
      if (!available.length) select.add(new Option('Nenhuma versão nova disponível', ''));
      for (const item of available) select.add(new Option('v' + item.version, item.version));
      $('install').disabled = !available.length;
      $('release-list').replaceChildren();
      for (const item of state.releases) {
        const row = document.createElement('div'); row.className = 'release';
        const name = document.createElement('span'); name.textContent = 'v' + item.version;
        const status = document.createElement('small'); status.textContent = installedSet.has(item.version) ? 'INSTALADA' : 'DISPONÍVEL';
        row.append(name, status); $('release-list').append(row);
      }
      if (!available.length) message('Você já tem todas as versões listadas instaladas.');
    } catch (error) {
      $('connection').textContent = 'Sem conexão';
      message(String(error), true);
    } finally { setBusy(false); }
  };
  $('version-select').addEventListener('change', () => {
    $('play').disabled = !$('version-select').value;
    $('save').disabled = !$('version-select').value;
  });
  $('release-select').addEventListener('change', () => { $('install').disabled = !$('release-select').value; });
  $('refresh').addEventListener('click', async () => { await refreshInstalled(); await refreshManifest(); });
  $('save').addEventListener('click', async () => {
    try { await invoke('set_preferred_version', { version: $('version-select').value }); await refreshInstalled(); message('Versão padrão atualizada.'); }
    catch (error) { message(String(error), true); }
  });
  $('play').addEventListener('click', async () => {
    try { const version = $('version-select').value; await invoke('set_preferred_version', { version }); await invoke('launch_game', { version }); message('Jogo iniciado na versão ' + version + '.'); }
    catch (error) { message(String(error), true); }
  });
  $('install').addEventListener('click', async () => {
    const version = $('release-select').value;
    if (!version || !window.confirm('Baixar e instalar Outbreak Zones v' + version + '? A instalação não substituirá outras versões.')) return;
    setBusy(true); message('Baixando e verificando o pacote…');
    try {
      await invoke('download_game_version', { version });
      await refreshInstalled(); await refreshManifest();
      $('version-select').value = version;
      $('play').disabled = false; $('save').disabled = false;
      message('Versão ' + version + ' instalada e verificada. Você pode iniciá-la agora.');
    } catch (error) { message(String(error), true); }
    finally { setBusy(false); }
  });
  (async () => {
    try { await refreshInstalled(); await refreshManifest(); }
    catch (error) { message(String(error), true); }
  })();
})();
