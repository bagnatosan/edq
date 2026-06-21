using System;
using System.Collections.Generic;

namespace edq.Models;

public class Poll
{
    public int Id { get; set; }
    
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    
    public int CreatorId { get; set; }
    public Player? Creator { get; set; }
    
    public string Question { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public List<PollOption> Options { get; set; } = new();
    
    public DateTime? TargetDate { get; set; }
}
