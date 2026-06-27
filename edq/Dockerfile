# --- ETAPA 1: COMPILACIÓN ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiar solo el .csproj primero para aprovechar el caché de Docker
COPY ["edq/edq.csproj", "edq/"]
RUN dotnet restore "edq/edq.csproj"

# Copiar el resto del código y compilar
COPY . .
WORKDIR "/src/edq"

# ReadyToRun (R2R) compila el código a binario nativo reduciendo el tiempo de arranque.
RUN dotnet publish "edq.csproj" -c Release -o /app/publish \
    /p:UseAppHost=false \
    /p:PublishReadyToRun=true

# --- ETAPA 2: PRODUCCIÓN (ALTO RENDIMIENTO) ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS final
WORKDIR /app
COPY --from=build /app/publish .

# Variables de entorno críticas para rendimiento en contenedores
ENV DOTNET_ENABLE_DIAGNOSTICS=0 \
    COMPlus_EnableDiagnostics=0 \
    ASPNETCORE_HTTP_PORTS=8080

EXPOSE 8080
ENTRYPOINT ["dotnet", "edq.dll"]
