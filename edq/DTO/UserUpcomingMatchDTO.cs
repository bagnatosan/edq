using System;
using System.Collections.Generic;

namespace edq.DTO;

public class UserUpcomingMatchDto
{
    public int MatchId { get; set; }
    public int GroupId { get; set; }
    public string GroupName { get; set; } = null!;
    public DateTime Date { get; set; }
    public List<string> Team1 { get; set; } = new();
    public List<string> Team2 { get; set; } = new();
}
