using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using edq.Data;
using edq.Models;
using edq.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace edq.Tests
{
    public class MatchmakingServiceTests
    {
        private readonly ITestOutputHelper _output;

        public MatchmakingServiceTests(ITestOutputHelper output)
        {
            _output = output;
        }
        private DbContextOptions<ApplicationDbContext> CreateNewContextOptions()
        {
            // Creamos un proveedor de base de datos en memoria único por cada test
            return new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        [Fact]
        public async Task BalanceTeamsAsync_ShouldDistributePlayersEvenlyAndMinimizeScoreDifference()
        {
            // Arrange
            var options = CreateNewContextOptions();
            int groupId = 1;

            using (var context = new ApplicationDbContext(options))
            {
                // Crear el grupo de prueba
                var group = new Group
                {
                    Id = groupId,
                    Name = "Fútbol 5 del Martes",
                    CreatorId = 99
                };
                context.Groups.Add(group);

                // Crear 10 jugadores con puntajes del 1 al 10
                // Suma total de scores = 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3 + 2 + 1 = 55
                // La diferencia óptima para dividir en dos equipos de 5 jugadores es:
                // Equipo A: sumatoria de 28. Equipo B: sumatoria de 27. (Diferencia = 1)
                var players = new List<Player>();
                var groupPlayers = new List<GroupPlayer>();

                for (int i = 1; i <= 10; i++)
                {
                    var player = new Player
                    {
                        Id = i,
                        Name = $"Jugador{i}",
                        LastName = $"Apellido{i}",
                        Email = $"player{i}@edq.com",
                        Password = "hashedpassword"
                    };
                    players.Add(player);

                    var groupPlayer = new GroupPlayer
                    {
                        GroupId = groupId,
                        PlayerId = i,
                        Score = (byte)i // Puntaje asignado igual al índice i (1 a 10)
                    };
                    groupPlayers.Add(groupPlayer);
                }

                context.Players.AddRange(players);
                context.GroupPlayers.AddRange(groupPlayers);
                await context.SaveChangesAsync();
            }

            // Act
            Dictionary<int, byte> balancedTeams;
            using (var context = new ApplicationDbContext(options))
            {
                var matchmakingService = new MatchmakingService(context);
                var playerIds = Enumerable.Range(1, 10).ToList();

                balancedTeams = await matchmakingService.BalanceTeamsAsync(playerIds, groupId);
            }

            // Assert
            Assert.NotNull(balancedTeams);
            Assert.Equal(10, balancedTeams.Count);

            // Verificar que se hayan dividido en exactamente dos equipos de 5 jugadores
            var team1 = balancedTeams.Where(t => t.Value == 1).Select(t => t.Key).ToList();
            var team2 = balancedTeams.Where(t => t.Value == 2).Select(t => t.Key).ToList();

            Assert.Equal(5, team1.Count);
            Assert.Equal(5, team2.Count);

            // Obtener los puntajes de cada jugador para calcular la diferencia final
            using (var context = new ApplicationDbContext(options))
            {
                var scores = await context.GroupPlayers
                    .Where(gp => gp.GroupId == groupId)
                    .ToDictionaryAsync(gp => gp.PlayerId, gp => (int)gp.Score);

                int sumTeam1 = team1.Sum(id => scores[id]);
                int sumTeam2 = team2.Sum(id => scores[id]);
                int difference = Math.Abs(sumTeam1 - sumTeam2);

                _output.WriteLine($"--- Resultados del Balanceo ---");
                _output.WriteLine($"Equipo A (Suma: {sumTeam1}): {string.Join(", ", team1.Select(id => $"Jugador {id} (Score: {scores[id]})"))}");
                _output.WriteLine($"Equipo B (Suma: {sumTeam2}): {string.Join(", ", team2.Select(id => $"Jugador {id} (Score: {scores[id]})"))}");
                _output.WriteLine($"Diferencia de habilidad: {difference}");

                // Esperamos que la diferencia sea la óptima (1) o extremadamente pequeña (por ejemplo, <= 3)
                // gracias a las iteraciones y el Hill Climbing
                Assert.True(difference <= 3, $"La diferencia entre equipos fue de {difference}, esperada <= 3. Sumas: {sumTeam1} vs {sumTeam2}");
            }
        }
    }
}
