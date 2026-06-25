
using System.ComponentModel.DataAnnotations;

namespace edq.Models;

public class ChatMessage
{
    public int Id { get; set; }
    
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    
    public int SenderId { get; set; }
    public Player? Sender { get; set; }
    
    [Required]
    [MaxLength(4096)]
    public string MessageText { get; set; } = string.Empty;
    
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
