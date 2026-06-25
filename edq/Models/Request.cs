using System.ComponentModel.DataAnnotations;

namespace edq.Models;

public class Request
{
    public int Id { get; set; }
    
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    
    public int PlayerId { get; set; }
    public Player? Player { get; set; }

    public DateTime DateRequest { get; set; } = DateTime.UtcNow;
    [MaxLength(20)]
    public string State { get; set; } = "Pending";
}