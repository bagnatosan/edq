using System;

namespace edq.Models;

public class ChatMessage
{
    public int Id { get; set; }
    
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    
    public int SenderId { get; set; }
    public Player? Sender { get; set; }
    
    public string MessageText { get; set; } = string.Empty;
    
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
