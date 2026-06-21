using System.Collections.Generic;

namespace edq.Models;

public class PollOption
{
    public int Id { get; set; }
    
    public int PollId { get; set; }
    public Poll? Poll { get; set; }
    
    public string OptionText { get; set; } = string.Empty;
    
    public List<PollVote> Votes { get; set; } = new();
}
