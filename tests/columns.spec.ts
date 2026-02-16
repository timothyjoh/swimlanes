import { test, expect } from '@playwright/test';

test.describe('Column CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Create a fresh board and navigate to it
    await page.goto('/');
    const boardName = `Col Test Board ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();

    const boardLink = page.getByRole('link', { name: boardName });
    await expect(boardLink).toBeVisible();
    await boardLink.click();

    // Verify we're on the board detail page
    await expect(page.locator('h1')).toContainText(boardName);
  });

  test('create a column', async ({ page }) => {
    const colName = `Column ${Date.now()}`;
    await page.getByPlaceholder('New column name').fill(colName);
    await page.getByRole('button', { name: 'Add Column' }).click();

    // Column heading should appear
    await expect(page.locator('h3').filter({ hasText: colName })).toBeVisible();
  });

  test('rename a column', async ({ page }) => {
    // Create a column
    const originalName = `Col Rename ${Date.now()}`;
    await page.getByPlaceholder('New column name').fill(originalName);
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: originalName })).toBeVisible();

    // Click on the column name to enter edit mode
    await page.locator('h3').filter({ hasText: originalName }).click();

    // Type new name and press Enter
    const newName = `Col Renamed ${Date.now()}`;
    const editInput = page.locator('input[type="text"][class*="border-blue"]');
    await editInput.fill(newName);
    await editInput.press('Enter');

    // Verify renamed column
    await expect(page.locator('h3').filter({ hasText: newName })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: originalName })).not.toBeVisible();
  });

  test('delete a column', async ({ page }) => {
    // Create a column
    const colName = `Col Delete ${Date.now()}`;
    await page.getByPlaceholder('New column name').fill(colName);
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: colName })).toBeVisible();

    // Set up dialog handler BEFORE clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    // Find the column container and click its Delete button
    const columnDiv = page.locator('div.w-72').filter({ hasText: colName });
    await columnDiv.getByRole('button', { name: 'Delete' }).click();

    // Verify column is removed
    await expect(page.locator('h3').filter({ hasText: colName })).not.toBeVisible();
  });

  test('reorder columns via drag-and-drop persists on reload', async ({ page }) => {
    // Create two columns
    const col1 = `First Col ${Date.now()}`;
    const col2 = `Second Col ${Date.now()}`;

    await page.getByPlaceholder('New column name').fill(col1);
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: col1 })).toBeVisible();

    await page.getByPlaceholder('New column name').fill(col2);
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: col2 })).toBeVisible();

    // Verify initial order: col1 before col2
    const headings = page.locator('h3');
    await expect(headings.nth(0)).toContainText(col1);
    await expect(headings.nth(1)).toContainText(col2);

    // Drag col2 onto col1 to reorder
    const source = page.locator('div.w-72').filter({ hasText: col2 });
    const target = page.locator('div.w-72').filter({ hasText: col1 });
    await source.dragTo(target);

    // Wait for API call to complete
    await page.waitForTimeout(500);

    // Verify new order: col2 before col1
    await expect(headings.nth(0)).toContainText(col2);
    await expect(headings.nth(1)).toContainText(col1);

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator('h3').nth(0)).toContainText(col2);
    await expect(page.locator('h3').nth(1)).toContainText(col1);
  });
});
