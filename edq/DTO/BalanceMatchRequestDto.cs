using System;
using System.Collections.Generic;

namespace edq.DTO
{
    public class BalanceMatchRequestDto
    {
        public int GroupId { get; set; }
        public DateTime Date { get; set; }
        public List<int> PlayerIds { get; set; } = new();
    }
}
