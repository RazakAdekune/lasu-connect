function lasuSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

window.LASU_DATA.adminUsers = Object.entries(window.LASU_DATA.facultyDepartments).flatMap(([faculty, departments]) =>
  departments.map((department) => {
    const code = lasuSlug(department);
    return {
      username: `admin-${code}`,
      password: `lasu-${code}`,
      faculty,
      department,
      name: `${department} Admin`
    };
  })
);
