
using System.ComponentModel.DataAnnotations;

namespace edq.Models;

public class PollOption
{
    public int Id { get; set; }
    
    public int PollId { get; set; }
    public Poll? Poll { get; set; }
    
    [MaxLength(20)]
    public string OptionText { get; set; } = string.Empty;
    
    public List<PollVote> Votes { get; set; } = new();
}
