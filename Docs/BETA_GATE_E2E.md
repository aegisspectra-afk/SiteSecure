# Production E2E Gate (Beta Task 04)

Run against **production** URLs (Vercel + production API), not localhost:8010.

## Flow

1. Register (new email)
2. Workspace creation (empty — Golden Rule)
3. Catalog Import (real price list)
4. Bulk Pricing (cost → list_price)
5. Customer create
6. Site create + link
7. Quote create + autosave
8. Build System 4/8 cameras
9. PDF preview/download
10. Approve → Project
11. Assign technician → Today
12. Field Job: Call/Nav → Site File → Photo → Checklist → Finish

## Pass criteria

- No blank screens / raw 500 to user
- PDF opens
- Today shows assigned job
- Photo appears on job/site
- Checklist persists after refresh

## Mobile Field QA (Beta Task 07)

Technician account on Chrome Android + Safari iPhone:

Login → Today → Call/Nav → Site File → Field Job → Camera → Checklist → Finish

Widths: 375 / 390 / 430
