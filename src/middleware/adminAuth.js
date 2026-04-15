/**
 * Protege endpoints administrativos com uma chave secreta.
 * A chave deve ser enviada no header:  x-admin-key: <ADMIN_KEY>
 * Configurada via variável de ambiente ADMIN_KEY no .env
 */
const ADMIN_KEY = process.env.ADMIN_KEY;

function adminAuth(req, res, next) {
  if (!ADMIN_KEY) {
    // Se ADMIN_KEY não estiver definida, bloqueia por segurança
    return res.status(503).json({ error: 'Servidor não configurado corretamente.' });
  }

  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  next();
}

module.exports = { adminAuth };
