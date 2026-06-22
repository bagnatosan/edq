using System.Threading.Tasks;

namespace edq.Services;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string body);
}
