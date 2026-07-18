// api/sitemap.js — Fonction serverless Vercel
// Génère dynamiquement le sitemap : page d'accueil + une entrée par concert publié
// à venir. Aucune dépendance npm : on interroge l'API REST de Supabase via fetch().
// Servie à l'adresse /sitemap.xml grâce à la règle de réécriture dans vercel.json.

const SUPABASE_URL = 'https://cdzlybupnuouyuamioqe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6M2OHNUPjkD8m6XPKkwZtA_RLWFmJE2';
const SITE = 'https://www.onyva-sorties.fr';

// Identique à la fonction slugify du site : les URLs doivent correspondre exactement
function slugify(str) {
  return (str || '').toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

module.exports = async (req, res) => {
  let concerts = [];
  try {
    const today = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ
    const query = '/rest/v1/concerts?select=id,titre,ville,date' +
      '&statut=eq.publie&date=gte.' + today + '&order=date.asc';
    const r = await fetch(SUPABASE_URL + query, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    });
    if (r.ok) concerts = await r.json();
  } catch (e) {
    // En cas d'erreur réseau/Supabase, on renvoie au moins l'accueil (sitemap jamais vide)
  }

  const urls = [{ loc: SITE + '/', priority: '1.0' }];
  for (const c of concerts) {
    const slug = slugify((c.titre || '') + '-' + (c.ville || '')) || 'concert';
    urls.push({
      loc: SITE + '/concert/' + slug + '/' + c.id,
      lastmod: c.date || null,
      priority: '0.8',
    });
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u =>
      '  <url>\n' +
      '    <loc>' + xmlEscape(u.loc) + '</loc>\n' +
      (u.lastmod ? '    <lastmod>' + xmlEscape(u.lastmod) + '</lastmod>\n' : '') +
      '    <priority>' + u.priority + '</priority>\n' +
      '  </url>'
    ).join('\n') +
    '\n</urlset>';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Mis en cache 1h côté CDN Vercel, rafraîchi en arrière-plan : évite de taper
  // Supabase à chaque passage de robot tout en restant à jour rapidement.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.end(body);
};
