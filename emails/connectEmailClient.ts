import nodemailer from 'nodemailer';
const ConnectEmailClient = async () => {
  try {
    const emailHost = process.env.EMAIL_HOST;
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    const emailPort = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587;
    const isSecurePort = emailPort === 465;
    
    if (!emailHost || !emailUser || !emailPassword) {
      throw new Error('Missing required email environment variables: EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD');
    }

    if (Number.isNaN(emailPort)) {
      throw new Error('EMAIL_PORT must be a valid number');
    }
    
    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: isSecurePort,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    console.info('[email] transporter-ready', {
      host: emailHost,
      port: emailPort,
      secure: isSecurePort,
      hasUser: Boolean(emailUser),
      hasPassword: Boolean(emailPassword),
    });
    return transporter;
  } catch (error) {
    console.error("Error connecting to email client:", error);
  }
};

export default ConnectEmailClient;