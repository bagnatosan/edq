using System.Net;
using System.Net.Mail;

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

        

        int port = int.TryParse(portStr, out var p) ? p : 587;
        bool enableSsl = !bool.TryParse(enableSslStr, out var ssl) || ssl;

        using var client = new SmtpClient(server, port);
        client.Credentials = new NetworkCredential(username, password);
        client.EnableSsl = enableSsl;
       
        
        var email = senderEmail ?? username ?? throw new InvalidOperationException("El correo remitente SMTP no esta configurado en appsettings.json");
        
        var fromAddress = new MailAddress(email, senderName ?? "edq. Soporte");
        var toAddress = new MailAddress(toEmail);

        
        using var mailMessage = new MailMessage(fromAddress, toAddress);
        mailMessage.Subject = subject;
        mailMessage.Body = body;
        mailMessage.IsBodyHtml = true;

        
        await client.SendMailAsync(mailMessage);
    }
}
