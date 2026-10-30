/* =====================================================================
   CONFIGURAÇÃO (OPCIONAL)
   Não precisa mexer aqui: no primeiro acesso o próprio site pede a URL e a
   chave do Supabase. Se preferir deixar fixo no arquivo, cole abaixo.
   ===================================================================== */
const SUPABASE_URL = 'https://cuhrhtkwfuwgsvsdrkng.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SgHwvT7fCqkUul5IuPB8ow_RbzKNwlk';
/* ===================================================================== */
function lerConfig() {
  if (!SUPABASE_URL.startsWith('COLE_') && !SUPABASE_KEY.startsWith('COLE_')) return { u: SUPABASE_URL, k: SUPABASE_KEY, fixo: true };
  try { const c = JSON.parse(localStorage.getItem('nc_cfg') || 'null'); if (c?.u && c?.k) return c; } catch {}
  return null;
}
function gravarConfig(u, k) { try { localStorage.setItem('nc_cfg', JSON.stringify({ u, k })); } catch {} }
function apagarConfig() { try { localStorage.removeItem('nc_cfg'); } catch {} }
// link de configuração para o outro aparelho: ...#cfg=<base64>
(function () {
  const m = location.hash.match(/^#cfg=(.+)$/);
  if (!m) return;
  try { const c = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); if (c.u && c.k) gravarConfig(c.u, c.k); } catch {}
  history.replaceState(null, '', location.pathname + location.search);
})();
