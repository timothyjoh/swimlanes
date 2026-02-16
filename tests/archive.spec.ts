import { test, expect } from '@playwright/test';

test.describe('Card Archiving', () => {
  let boardName: string;

  test.beforeEach(async ({ page }) => {
    boardName = `Archive Test Board ${Date.now()}`;

    // Create a board and navigate to it
    await page.goto('/');
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    // Create a column
    await page.getByPlaceholder('New column name').fill('To Do');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'To Do' })).toBeVisible();

    // Create a card
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    await column.getByPlaceholder('Add a card...').fill('Test Card');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).toBeVisible();
  });

  test('archives a card and removes it from board view', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();

    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).not.toBeVisible();
    await expect(column.locator('text=No cards yet')).toBeVisible();
  });

  test('shows archive count badge after archiving', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();

    await expect(page.locator('text=1 archived')).toBeVisible();
  });

  test('navigates to archive page via badge', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();
    await page.click('text=1 archived');
    await page.waitForURL(/\/boards\/\d+\/archive/);

    await expect(page.getByRole('heading', { name: /Archived Cards/ })).toBeVisible();
  });

  test('shows archived card on archive page', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();
    await page.click('text=1 archived');
    await page.waitForURL(/\/boards\/\d+\/archive/);

    await expect(page.locator('text=Test Card')).toBeVisible();
    await expect(page.locator('text=Originally in:')).toBeVisible();
  });

  test('restores a card from archive page', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();
    await page.click('text=1 archived');
    await page.waitForURL(/\/boards\/\d+\/archive/);

    await page.getByRole('button', { name: 'Restore' }).click();

    await expect(page.locator('text=Test Card')).not.toBeVisible();
    await expect(page.locator('text=No archived cards')).toBeVisible();

    // Go back and verify card is restored
    await page.click('text=← Back to Board');
    await page.waitForURL(/\/boards\/\d+$/);

    const restoredColumn = page.locator('div.w-72').filter({ hasText: 'To Do' });
    await expect(restoredColumn.locator('.font-medium').filter({ hasText: 'Test Card' })).toBeVisible();
  });

  test('permanently deletes a card from archive page', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();
    await page.click('text=1 archived');
    await page.waitForURL(/\/boards\/\d+\/archive/);

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('text=Test Card')).not.toBeVisible();
    await expect(page.locator('text=No archived cards')).toBeVisible();
  });

  test('archived cards are excluded from search', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });

    // Create another card that won't be archived
    await column.getByPlaceholder('Add a card...').fill('Active Card');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Active Card' })).toBeVisible();

    // Archive first card
    const archiveButtons = column.locator('div.bg-white').filter({ hasText: 'Test Card' }).getByRole('button', { name: 'Archive' });
    await archiveButtons.click();

    // Wait for archive to complete
    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).not.toBeVisible();

    // Search for the archived card
    await page.locator('[aria-label="Search cards"]').fill('Test Card');
    await page.waitForTimeout(400); // Wait for debounce

    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).not.toBeVisible();
    // Active Card doesn't match search either
    await expect(column.locator('.font-medium').filter({ hasText: 'Active Card' })).not.toBeVisible();

    // Clear search and verify only active card shows
    await page.locator('[aria-label="Clear search"]').click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Active Card' })).toBeVisible();
  });

  test('archive badge shows correct count for multiple cards', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });

    // Create more cards
    await column.getByPlaceholder('Add a card...').fill('Card 2');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Card 2' })).toBeVisible();

    await column.getByPlaceholder('Add a card...').fill('Card 3');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Card 3' })).toBeVisible();

    // Archive two cards
    const firstCard = column.locator('div.bg-white').filter({ hasText: 'Test Card' });
    await firstCard.getByRole('button', { name: 'Archive' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).not.toBeVisible();

    const secondCard = column.locator('div.bg-white').filter({ hasText: 'Card 2' });
    await secondCard.getByRole('button', { name: 'Archive' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Card 2' })).not.toBeVisible();

    await expect(page.locator('text=2 archived')).toBeVisible();
  });

  test('empty archive page shows correct message', async ({ page }) => {
    // Navigate to archive without archiving anything
    const boardUrl = page.url();
    await page.goto(boardUrl + '/archive');

    await expect(page.locator('text=No archived cards')).toBeVisible();
  });

  test('archive preserves card color and description', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });

    // Click on card to edit it
    await column.locator('.font-medium').filter({ hasText: 'Test Card' }).click();

    // Add description and color
    await column.getByPlaceholder('Description (optional)').fill('Important notes');
    await column.locator('select').selectOption('red');
    await column.getByRole('button', { name: 'Save' }).click();

    // Archive card
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });
    await cardDiv.getByRole('button', { name: 'Archive' }).click();

    // Go to archive view
    await page.click('text=1 archived');
    await page.waitForURL(/\/boards\/\d+\/archive/);

    // Verify description and color preserved in archive
    await expect(page.locator('text=Important notes')).toBeVisible();
    await expect(page.locator('[aria-label="Color: red"]')).toBeVisible();

    // Restore card
    await page.getByRole('button', { name: 'Restore' }).click();

    // Go back to board
    await page.click('text=← Back to Board');

    // Verify card is back and data preserved
    await column.locator('.font-medium').filter({ hasText: 'Test Card' }).click();
    await expect(column.getByPlaceholder('Description (optional)')).toHaveValue('Important notes');
  });

  test('archive persists after page reload', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });
    const cardDiv = column.locator('div.bg-white').filter({ hasText: 'Test Card' });

    await cardDiv.getByRole('button', { name: 'Archive' }).click();
    await expect(page.locator('text=1 archived')).toBeVisible();

    // Reload page
    await page.reload();

    // Badge should still show
    await expect(page.locator('text=1 archived')).toBeVisible();

    // Card should still be archived (not visible in column)
    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).not.toBeVisible();

    // Navigate to archive view
    await page.click('text=1 archived');
    await expect(page.locator('text=Test Card')).toBeVisible();
  });

  test('archive badge decreases after restoring a card', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'To Do' });

    // Create a second card
    await column.getByPlaceholder('Add a card...').fill('Card Two');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Card Two' })).toBeVisible();

    // Archive both cards
    const firstCard = column.locator('div.bg-white').filter({ hasText: 'Test Card' });
    await firstCard.getByRole('button', { name: 'Archive' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Test Card' })).not.toBeVisible();

    const secondCard = column.locator('div.bg-white').filter({ hasText: 'Card Two' });
    await secondCard.getByRole('button', { name: 'Archive' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Card Two' })).not.toBeVisible();

    await expect(page.locator('text=2 archived')).toBeVisible();

    // Navigate to archive and restore one card
    await page.click('text=2 archived');
    await page.waitForURL(/\/boards\/\d+\/archive/);

    // Restore first card
    await page.getByRole('button', { name: 'Restore' }).first().click();

    // Go back to board
    await page.click('text=← Back to Board');
    await page.waitForURL(/\/boards\/\d+$/);

    // Badge should now show 1 archived
    await expect(page.locator('text=1 archived')).toBeVisible();
  });
});
