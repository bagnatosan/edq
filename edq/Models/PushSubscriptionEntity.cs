
using System.ComponentModel.DataAnnotations;

namespace edq.Models;

public class PushSubscriptionEntity
{
    public int Id { get; set; }
    
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    
    [Required]
    [MaxLength(500)]
    public string Endpoint { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string P256dh { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string Auth { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
