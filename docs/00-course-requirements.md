# Course Requirements

The authoritative checklist for this project. Every phase is audited against this file before its
work is output. Nothing here is optional unless the course says so explicitly.

Deadline: 6 September 2026.

## 1. Submission Deliverables

Ten items must be submitted.

- [ ] 1. Live Vercel URL, publicly reachable.
- [ ] 2. GitHub repository.
- [x] 3. Product specification document.
- [ ] 4. Technical planning document.
- [ ] 5. Test specification document.
- [ ] 6. Test code.
- [ ] 7. Basic scale document.
- [ ] 8. Basic security document.
- [ ] 9. Local run instructions, including an explanation of every environment variable.
- [ ] 10. Presentation deck for a 10 to 15 minute presentation.

## 2. Required Stack

- [ ] Next.js.
- [ ] TypeScript.
- [ ] Supabase for database and authentication.
- [ ] Vercel for deployment.
- [ ] The application is reachable at a public URL, not only on localhost.

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

- [ ] System components.
- [ ] Use of a database.
- [ ] Central entities.
- [ ] All pages.
- [ ] Server actions and route handlers.
- [ ] Data flow between frontend, backend, and database.
- [ ] Users and permissions.
- [ ] External libraries and services, each with a reason.
- [ ] Folder structure.
- [ ] Component structure.
- [ ] Database structure.
- [ ] Central CRUD operations.
- [ ] API description.
- [ ] Central business logic.
- [ ] State management.
- [ ] Error handling.
- [ ] Input validation.
- [ ] The core user experience.

## 5. Test Coverage

Not every line must be tested, but the central processes must be. Documented manual tests are
acceptable where automation is not appropriate.

- [ ] Core features.
- [ ] Invalid inputs.
- [ ] Central business processes.
- [ ] Permission differences between user types.
- [ ] Database.
- [ ] Edge cases.
- [ ] Basic UI.

## 6. Security Document

Must cover:

- [ ] How authentication works.
- [ ] How authorisation works.
- [ ] Which actions require login.
- [ ] How one user is prevented from reaching another user's data.
- [ ] How inputs are validated.
- [ ] How API calls are protected.
- [ ] How secrets such as API keys are stored.
- [ ] Which risks remain.

## 7. Scale Document

Must cover:

- [ ] Behaviour at tens or hundreds of users.
- [ ] Which queries are heavy.
- [ ] Whether indexes are needed.
- [ ] How unnecessary data loading is avoided.
- [ ] Correct use of pagination.
- [ ] Separation of client and server responsibilities.
- [ ] Current limitations.
- [ ] What would be improved for larger scale.

## 8. Internal Technical Explainer (recommended by the course)

Must cover:

- [ ] The architecture.
- [ ] The key files.
- [ ] The code behind the flows.
- [ ] The database.
- [ ] The tests.
- [ ] The technical decisions.

## 9. Presentation

Must cover:

- [ ] What the product is.
- [ ] The problem.
- [ ] The users.
- [ ] The business value.
- [ ] How the system is built.
- [ ] The architecture.
- [ ] The database.
- [ ] The central flows.
- [ ] The tests.
- [ ] Scale thinking.
- [ ] Security thinking.
- [ ] What would be improved with more time.

## 10. Grading Priority

- [ ] Quality of thinking is graded above feature count. A small, clear, useful, secure, well-built
      product beats a large, messy, unstable one.
- [ ] The student must understand the code deeply enough to explain every library, component,
      method, and technical decision under questioning.
