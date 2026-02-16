import { test, expect } from '@playwright/test';

test.describe('Board CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('SwimLanes');
  });

  test('create a new board', async ({ page }) => {
    const boardName = `Test Board ${Date.now()}`;

    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();

    // Board should appear in the list as a link
    await expect(page.getByRole('link', { name: boardName })).toBeVisible();
  });

  test('rename a board', async ({ page }) => {
    // Create a board first
    const originalName = `Board Rename ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(originalName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await expect(page.getByRole('link', { name: originalName })).toBeVisible();

    // Click "Edit" button on the board's row
    const boardRow = page.locator('li').filter({ hasText: originalName });
    await boardRow.getByRole('button', { name: 'Edit' }).click();

    // Type new name and press Enter
    const newName = `Renamed Board ${Date.now()}`;
    const editInput = boardRow.locator('input[type="text"]');
    await editInput.fill(newName);
    await editInput.press('Enter');

    // Verify renamed board appears
    await expect(page.getByRole('link', { name: newName })).toBeVisible();
    // Original name should be gone
    await expect(page.getByRole('link', { name: originalName })).not.toBeVisible();
  });

  test('delete a board', async ({ page }) => {
    // Create a board first
    const boardName = `Board Delete ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await expect(page.getByRole('link', { name: boardName })).toBeVisible();

    // Set up dialog handler BEFORE clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    // Click "Delete" on the board's row
    const boardRow = page.locator('li').filter({ hasText: boardName });
    await boardRow.getByRole('button', { name: 'Delete' }).click();

    // Verify board is removed
    await expect(page.getByRole('link', { name: boardName })).not.toBeVisible();
  });
});
