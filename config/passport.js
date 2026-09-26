const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Hash de relleno para que el tiempo de respuesta sea similar exista o no el email
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const usuario = await prisma.usuario.findUnique({
          where: { email: email.trim().toLowerCase() },
        });

        const passwordValida = await bcrypt.compare(
          password,
          usuario ? usuario.password_hash : DUMMY_HASH
        );

        if (!usuario || !passwordValida) {
          return done(null, false, { message: 'Email o contraseña incorrectos' });
        }

        return done(null, usuario);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// En la sesión solo se guarda el id del usuario
passport.serializeUser((usuario, done) => {
  done(null, usuario.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, email: true, rol: true, area: true },
    });
    done(null, usuario || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
