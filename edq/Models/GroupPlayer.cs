namespace edq.Models;

public class GroupPlayer
{
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    
    public int PlayerId { get; set; }
    public Player? Player { get; set; }

    public DateTime EntryDate = DateTime.UtcNow;
    public byte Score { get; set; }
}