using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using System;

namespace edq.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        var smtpSettings = _configuration.GetSection("SmtpSettings");
        var server = smtpSettings["Server"];
        var portStr = smtpSettings["Port"];
        var username = smtpSettings["Username"];
        var password = smtpSettings["Password"];
        var enableSslStr = smtpSettings["EnableSsl"];
        var senderName = smtpSettings["SenderName"];
        var senderEmail = smtpSettings["SenderEmail"];

        if (string.IsNullOrEmpty(server) || string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password) || 
            username == "TU-CORREO@gmail.com" || password == "TU-CONTRASEÑA-DE-APLICACION")
        {
            throw new InvalidOperationException("La configuración SMTP está incompleta en appsettings.json. Por favor, edita el archivo con tus credenciales reales.");
        }

        int port = int.TryParse(portStr, out var p) ? p : 587;
        bool enableSsl = !bool.TryParse(enableSslStr, out var ssl) || ssl;

        using var client = new SmtpClient(server, port)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = enableSsl
        };

        var fromAddress = new MailAddress(senderEmail ?? username, senderName ?? "edq. Soporte");
        var toAddress = new MailAddress(toEmail);

        using var mailMessage = new MailMessage(fromAddress, toAddress)
        {
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        await client.SendMailAsync(mailMessage);
    }
}
