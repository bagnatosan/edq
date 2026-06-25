using System.ComponentModel.DataAnnotations;

namespace edq.Models;

public class Match
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    
    public DateTime Date { get; set; }
    
    [MaxLength(20)]
    public string State { get; set; } = "Pending";

    public List<MatchPlayer> MatchPlayers { get; set; } = new();
}