# DeepKeel Survey QA Checklist

## Auth
- [ ] Login works with admin credentials
- [ ] Wrong password rejected
- [ ] Logout works

## Vessel Info
- [ ] Save vessel info persists in session
- [ ] Reload page retains saved values

## Checklist (120)
- [ ] Item update changes rating/notes
- [ ] Critical/Moderate counts update in dashboard
- [ ] BCI updates correctly

## Negotiation Calculator
- [ ] Formula outputs adjusted value
- [ ] Repairs + contingency deducted
- [ ] Discount applied to final offer

## Report
- [ ] Includes vessel details
- [ ] Includes critical/moderate findings
- [ ] Recommendation visible

## Deployment
- [ ] Docker container healthy
- [ ] Tunnel endpoint reachable externally
- [ ] Subdomain resolves via Cloudflare
