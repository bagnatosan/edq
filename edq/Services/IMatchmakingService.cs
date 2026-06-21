using System.Collections.Generic;
using System.Threading.Tasks;
using edq.Models;

namespace edq.Services
{
    public interface IMatchmakingService
    {
        Task<Dictionary<int, byte>> BalanceTeamsAsync(List<int> playerId, int grupoId);
        Task<bool> CreateMatchAsync(int groupId , DateTime date , List<int> playerIds , Dictionary<int, byte> teamsBalanced);
        
    }
}
