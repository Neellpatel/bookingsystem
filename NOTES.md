# Doctor on Call — Project Notes

## Live Deployment
- **Production URL:** https://bookingsystem-sooty-eta.vercel.app
- **GitHub Repo:** https://github.com/patelakshdev/bookingsystem
- **Vercel Dashboard:** https://vercel.com/vars2/bookingsystem

## Demo Credentials
| Role    | Email                                   | Password     |
|---------|-----------------------------------------|--------------|
| Patient | patient@doctoroncall.example          | patient123   |
| Staff   | reception@doctoroncall.example        | reception123 |

## Git History
| Commit  | Description                                                          |
|---------|----------------------------------------------------------------------|
| e3dca93 | Mobile-first redesign: bottom nav, glassmorphism, touch cards        |
| d5e8b89 | Export default handler function in server.js for Vercel              |
| 79b02b5 | Fix serverless SQLite path fallback to /tmpdir                       |
| eb96455 | Initial commit: Ready for Git push and Vercel deployment             |

## Database
- **Local Dev:** SQLite auto-created at `data/clinic.db` — no setup needed
- **Vercel / Production:** Set `DATABASE_URL` env var in Vercel to use PostgreSQL (Neon/Supabase) or `TURSO_DATABASE_URL` for Turso

## To run locally
```bash
npm install
npm start
# → http://localhost:3000
```

## To deploy updates
```bash
git add .
git commit -m "your message"
git push origin main
vercel --prod --yes
```
