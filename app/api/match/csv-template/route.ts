export async function GET() {
  // Define the exact headers for the CSV template.
  const headers = [
    'team1_player1_name', 'team1_player1_email',
    'team1_player2_name', 'team1_player2_email',
    'team2_player1_name', 'team2_player1_email',
    'team2_player2_name', 'team2_player2_email',
    'team1_score',
    'team2_score'
  ];

  const placeholderData: Record<string, string> = {
    team1_player1_name: 'Jessica', team1_player1_email: 'player1@example.com',
    team1_player2_name: 'Martin', team1_player2_email: 'player2@example.com',
    team2_player1_name: 'Hillary', team2_player1_email: 'player3@example.com',
    team2_player2_name: 'James', team2_player2_email: 'player4@example.com',
    team1_score: '11',
    team2_score: '5'
  };

  const headerRow = headers.join(',');
  const placeholderRow = headers.map(header => placeholderData[header]).join(',');

  const csvContent = `${headerRow}\n${placeholderRow}`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="match_upload_template.csv"',
    },
  });
}