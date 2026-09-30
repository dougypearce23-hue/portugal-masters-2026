export const metadata = {
  title: "Portugal Masters 2026",
  description: "Portugal Masters 2026 Golf Tour",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
