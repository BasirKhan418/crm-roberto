
export const getEmailTemplate = (content: string) => {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
 <head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>Jogaad India</title>
  <!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]-->
  <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
  <!--[if gte mso 9]>
<noscript>
         <xml>
           <o:OfficeDocumentSettings>
           <o:AllowPNG></o:AllowPNG>
           <o:PixelsPerInch>96</o:PixelsPerInch>
           </o:OfficeDocumentSettings>
         </xml>
      </noscript>
<![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      background: #f5f5f5;
      font-family: 'Inter', Arial, sans-serif;
    }
    table {
      border-spacing: 0;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background: #f5f5f5;
      padding: 30px 0;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      font-family: 'Inter', Arial, sans-serif;
      color: #333333;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      border-radius: 16px;
      overflow: hidden;
      position: relative;
    }
    
    .header {
      background: #ffffff;
      padding: 35px 20px;
      text-align: center;
      position: relative;
      border-bottom: 4px solid #F9A825;
    }
    
    .header::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #F9A825 0%, #0A3D62 100%);
    }
    
    .header img {
      max-width: 200px;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    
    .banner {
      background: #0A3D62;
      padding: 40px 20px;
      text-align: center;
      position: relative;
    }
    
    .banner h1 {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 10px 0;
      line-height: 1.3;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .banner p {
      color: #e0f2f7;
      font-size: 16px;
      margin: 0;
      line-height: 1.5;
    }
    
    .content {
      padding: 40px 30px;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #ffffff;
      position: relative;
    }
    
    .content h2 {
      color: #0A3D62;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 15px 0;
    }
    
    .content p {
      margin: 0 0 15px 0;
    }
    
    .cta-button {
      display: inline-block;
      padding: 16px 36px;
      background: #0A3D62;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 10px 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    /* Decorative wave divider */
    .wave-divider {
      height: 30px;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120"><path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="%23ffffff"></path></svg>') no-repeat center;
      background-size: cover;
      margin: -1px 0 0 0;
    }
    
    .highlight-box {
      background: #f8f9fa;
      border-left: 4px solid #0A3D62;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .corner-decor {
      display: none;
    }
    
    .footer {
      background: #0A3D62;
      padding: 40px 20px;
      text-align: center;
      color: #b0b8bf;
    }
    
    .footer-links {
      margin: 15px 0;
    }
    
    .footer-links a {
      color: #b0b8bf;
      text-decoration: none;
      margin: 0 12px;
      font-size: 13px;
    }
    
    .footer-links a:hover {
      color: #ffffff;
    }
    
    .social-icons {
      margin: 25px 0;
    }
    
    .social-icon {
      display: inline-block;
      width: 44px;
      height: 44px;
      margin: 0 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      text-align: center;
      line-height: 44px;
    }
    
    .social-icon img {
      width: 22px;
      height: 22px;
      vertical-align: middle;
    }
    
    .tagline {
      margin: 15px 0 0 0;
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
    
    @media screen and (max-width: 600px) {
      .main {
        width: 100% !important;
        border-radius: 0 !important;
      }
      .content {
        padding: 30px 20px !important;
      }
      .banner h1 {
        font-size: 24px !important;
      }
      .cta-button {
        display: block !important;
        margin: 15px 0 !important;
      }
      .social-icon {
        width: 40px !important;
        height: 40px !important;
        line-height: 40px !important;
        margin: 0 6px !important;
      }
    }
  </style>
 </head>
 <body style="margin:0;padding:0;">
  <center class="wrapper">
    <table class="main" width="100%" style="max-width:600px;">
      <!-- Header -->
      <tr>
        <td class="header" style="background:#ffffff;padding:35px 20px;text-align:center;border-bottom:4px solid #F9A825;">
          <a href="https://roberto.devsomeware.com" target="_blank" style="text-decoration:none;display:block;">
            <img src="https://roberto.devsomeware.com/logo-v2.webp" alt="crm app" style="display:block;margin:0 auto;max-width:200px;height:auto;">
          </a>
        </td>
      </tr>

      <!-- Content -->
      <tr>
        <td class="content">
          ${content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td class="footer">
          <!-- Social Icons -->
          <div class="social-icons">
            <a href="https://www.facebook.com/" class="social-icon" target="_blank" style="text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" style="width:22px;height:22px;vertical-align:middle;">
            </a>
            <a href="https://www.instagram.com/" class="social-icon" target="_blank" style="text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" style="width:22px;height:22px;vertical-align:middle;">
            </a>
            <a href="https://x.com/" class="social-icon" target="_blank" style="text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/512/5968/5968958.png" alt="X" style="width:22px;height:22px;vertical-align:middle;">
            </a>
            <a href="http://www.linkedin.com/in/" class="social-icon" target="_blank" style="text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn" style="width:22px;height:22px;vertical-align:middle;">
            </a>
            <a href="https://youtube.com/" class="social-icon" target="_blank" style="text-decoration:none;">
              <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" style="width:22px;height:22px;vertical-align:middle;">
            </a>
          </div>

          <!-- Footer Links -->
          <div class="footer-links" style="margin:20px 0;">
            <a href="https://roberto.devsomeware.com/" style="color:#b0b8bf;text-decoration:none;margin:0 12px;font-size:13px;">Home</a>
            <a href="https://roberto.devsomeware.com/about" style="color:#b0b8bf;text-decoration:none;margin:0 12px;font-size:13px;">About</a>
            <a href="https://roberto.devsomeware.com/features" style="color:#b0b8bf;text-decoration:none;margin:0 12px;font-size:13px;">Features</a>
            <a href="https://roberto.devsomeware.com/contact" style="color:#b0b8bf;text-decoration:none;margin:0 12px;font-size:13px;">Contact</a>
          </div>

          <!-- Legal Links -->
          <div style="margin:15px 0;font-size:12px;">
            <a href="https://roberto.devsomeware.com/privacy" style="color:#8b9299;text-decoration:none;margin:0 10px;">Privacy Policy</a>
            <span style="color:#4a5258;">•</span>
            <a href="https://roberto.devsomeware.com/terms" style="color:#8b9299;text-decoration:none;margin:0 10px;">Terms</a>
          </div>

          <!-- Copyright -->
          <p style="margin:20px 0 0 0;font-size:13px;color:#8b9299;">
            &copy; ${new Date().getFullYear()} CRM Roberto. All rights reserved.<br>
            <a href="https://roberto.devsomeware.com" style="color:#ffffff;text-decoration:none;">www.roberto.devsomeware.com</a>
          </p>
          
          <!-- Animated Tagline -->
          <p class="tagline">
            Empowering Your Business Journey with Innovative CRM Solutions
          </p>
        </td>
      </tr>
    </table>
  </center>
 </body>
</html>
  `;
};