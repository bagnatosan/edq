using edq.Data;
using edq.Models;
using Microsoft.EntityFrameworkCore;


namespace edq.Services
{
    public class MatchmakingService : IMatchmakingService
    {
        private readonly ApplicationDbContext _context;

        public MatchmakingService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Dictionary<int, byte>> BalanceTeamsAsync(List<int> playerId, int grupoId)
        {
            const byte limitWithoutImprovement = 100;
            ushort count = 0;
            const byte numberOfRestarts = 20;
            
            var lessDifference = int.MaxValue;
            
            
            var players = await _context.GroupPlayers
                .Where(p => p.GroupId == grupoId && playerId.Contains(p.PlayerId))
                .Select( p => new { p.PlayerId, p.Score })
                .ToListAsync();

            var half = players.Count / 2;


            List<int> bestTeamA = new();
            List<int> bestTeamB = new();

            for (int i = 0; i < numberOfRestarts; i++)
            {
                count = 0;
                var random = new Random();
                var shuffledPlayers = players.OrderBy(p => random.Next()).ToList();

                var teamA = shuffledPlayers.Take(half).ToList();
                var teamB = shuffledPlayers.Skip(half).ToList();

                // 1. Calculamos la diferencia inicial de la mezcla
                var currentDifference = Math.Abs(teamA.Sum(p => p.Score) - teamB.Sum(p => p.Score));

                if (currentDifference < lessDifference)
                {
                    lessDifference = currentDifference;
                    bestTeamA = teamA.Select(t => t.PlayerId).ToList();
                    bestTeamB = teamB.Select(t => t.PlayerId).ToList();
                }

                // 2. Bucle de intercambios (Hill Climbing)
                while (count < limitWithoutImprovement)
                {
                    int indexA = random.Next(teamA.Count);
                    int indexB = random.Next(teamB.Count);

                    var playerA = teamA[indexA];
                    var playerB = teamB[indexB];

                    // Simulamos el intercambio
                    var sumAAfterSwap = teamA.Sum(p => p.Score) - playerA.Score + playerB.Score;
                    var sumBAfterSwap = teamB.Sum(p => p.Score) - playerB.Score + playerA.Score;
                    var newDifference = Math.Abs(sumAAfterSwap - sumBAfterSwap);

                    if (newDifference < currentDifference)
                    {
                        // Realizamos el intercambio
                        teamA[indexA] = playerB;
                        teamB[indexB] = playerA;

                        currentDifference = newDifference;
                        count = 0; // Reseteamos al mejorar

                        if (currentDifference < lessDifference)
                        {
                            lessDifference = currentDifference;
                            bestTeamA = teamA.Select(t => t.PlayerId).ToList();
                            bestTeamB = teamB.Select(t => t.PlayerId).ToList();
                        }
                    }
                    else
                    {
                        count++;
                    }
                }
            }
            
            Dictionary<int, byte> results = new();

            foreach (var i in bestTeamA)
            {
                results.Add(i , 1);
            }

            foreach (var i in bestTeamB)
            {
                results.Add(i, 2);
            }
            
            
            return results;
        }

        public async Task<bool> CreateMatchAsync(int groupId, DateTime date, List<int> playerIds,
            Dictionary<int, byte> teamsBalanced)
        {
            var match = new Match()
            {
                GroupId = groupId,
                Date = date,
                State = "Pending",
                
                MatchPlayers = teamsBalanced.Select( t => new MatchPlayer
                {
                    PlayerId = t.Key,
                    Team = t.Value
                }).ToList()
            };

            _context.Add(match);

            try
            {
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }
        
        
        
        
    }
}
