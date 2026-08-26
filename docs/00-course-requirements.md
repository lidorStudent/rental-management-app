# Course Requirements

The authoritative checklist for this project. Every phase is audited against this file before its
work is output. Nothing here is optional unless the course says so explicitly.

Deadline: 6 September 2026.

## 1. Submission Deliverables

Ten items must be submitted.

- [x] 1. Live Vercel URL, publicly reachable.
- [x] 2. GitHub repository.
- [x] 3. Product specification document.
- [x] 4. Technical planning document.
- [x] 5. Test specification document.
- [x] 6. Test code.
- [x] 7. Basic scale document.
- [x] 8. Basic security document.
- [x] 9. Local run instructions, including an explanation of every environment variable.
- [x] 10. Presentation deck for a 10 to 15 minute presentation.

## 2. Required Stack

- [x] Next.js.
- [x] TypeScript.
- [x] Supabase for database and authentication.
- [x] Vercel for deployment.
- [x] The application is reachable at a public URL, not only on localhost.

## 3. Product Specification Document

Must cover:

- [x] The problem solved.
- [x] The users.
- [x] The customer.
- [x] The business goals.
- [x] The software capabilities needed to achieve those goals.
- [x] The central processes users carry out, end to end.

## 4. Technical Planning Document

Must cover:

- [x] System components.
- [x] Use of a database.
- [x] Central entities.
- [x] All pages.
- [x] Server actions and route handlers.
- [x] Data flow between frontend, backend, and database.
- [x] Users and permissions.
- [x] External libraries and services, each with a reason.
- [x] Folder structure.
- [x] Component structure.
- [x] Database structure.
- [x] Central CRUD operations.
- [x] API description.
- [x] Central business logic.
- [x] State management.
- [x] Error handling.
- [x] Input validation.
- [x] The core user experience.

## 5. Test Coverage

Not every line must be tested, but the central processes must be. Documented manual tests are
acceptable where automation is not appropriate.

- [x] Core features.
- [x] Invalid inputs.
- [x] Central business processes.
- [x] Permission differences between user types.
- [x] Database.
- [x] Edge cases.
- [x] Basic UI.

## 6. Security Document

Must cover:

- [x] How authentication works.
- [x] How authorisation works.
- [x] Which actions require login.
- [x] How one user is prevented from reaching another user's data.
- [x] How inputs are validated.
- [x] How API calls are protected.
- [x] How secrets such as API keys are stored.
- [x] Which risks remain.

## 7. Scale Document

Must cover:

- [x] Behaviour at tens or hundreds of users.
- [x] Which queries are heavy.
- [x] Whether indexes are needed.
- [x] How unnecessary data loading is avoided.
- [x] Correct use of pagination.
- [x] Separation of client and server responsibilities.
- [x] Current limitations.
- [x] What would be improved for larger scale.

## 8. Internal Technical Explainer (recommended by the course)

Must cover:

- [x] The architecture.
- [x] The key files.
- [x] The code behind the flows.
- [x] The database.
- [x] The tests.
- [x] The technical decisions.

## 9. Presentation

Must cover:

- [x] What the product is.
- [x] The problem.
- [x] The users.
- [x] The business value.
- [x] How the system is built.
- [x] The architecture.
- [x] The database.
- [x] The central flows.
- [x] The tests.
- [x] Scale thinking.
- [x] Security thinking.
- [x] What would be improved with more time.

## 10. Grading Priority

- [x] Quality of thinking is graded above feature count. A small, clear, useful, secure, well-built
      product beats a large, messy, unstable one.
- [x] The student must understand the code deeply enough to explain every library, component,
      method, and technical decision under questioning.
