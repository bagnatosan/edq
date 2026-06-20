using System.Collections.Generic;
using System.Threading.Tasks;
using edq.Data;

namespace edq.Services
{
    public class MatchmakingService : IMatchmakingService
    {
        private readonly ApplicationDbContext _context;
        private readonly IMatchmakingService _matchmakingService;

        public MatchmakingService(ApplicationDbContext context, IMatchmakingService matchmakingService)
        {
            _context = context;
            _matchmakingService = matchmakingService;
        }

        public async Task<Dictionary<int, byte>> BalanceTeamsAsync(List<int> playerId, int grupoId)
        {
            
        }
    }
}
