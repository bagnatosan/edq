namespace edq.Models;

public class Group
{
    public int Id { get; set; }
    
    public string Name { get; set; } = string.Empty;

    public int CreatorId { get; set; } 
    public Player? Creator { get; set; }

    public List<GroupPlayer> GroupPlayers { get; set; } = new();
    public List<Match> Matches { get; set; } = new();


}