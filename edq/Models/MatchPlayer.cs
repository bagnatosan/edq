namespace edq.Models;

public class MatchPlayer
{
    public int MatchId { get; set; }
    public Match? Match { get; set; }
    
    public int PlayerId { get; set; }
    public Player? Player { get; set; }

    public byte Team { get; set; } = 0;
}