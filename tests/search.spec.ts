import { test, expect } from '@playwright/test';

test.describe('Card Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    // Create fresh board
    await page.goto('/');
    const boardName = `Search Test ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    // Create two columns
    await page.getByPlaceholder('New column name').fill('Todo');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Todo' })).toBeVisible();

    await page.getByPlaceholder('New column name').fill('In Progress');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'In Progress' })).toBeVisible();

    // Create cards in Todo column
    const todoColumn = page.locator('div.w-72').filter({ hasText: 'Todo' });
    for (const title of ['Bug fix authentication', 'Feature red button', 'Write tests']) {
      await todoColumn.getByPlaceholder('Add a card...').fill(title);
      await todoColumn.getByRole('button', { name: 'Add Card' }).click();
      await expect(todoColumn.locator(`text=${title}`)).toBeVisible();
    }

    // Create cards in In Progress column
    const ipColumn = page.locator('div.w-72').filter({ hasText: 'In Progress' });
    for (const title of ['Refactor authentication', 'Add blue theme']) {
      await ipColumn.getByPlaceholder('Add a card...').fill(title);
      await ipColumn.getByRole('button', { name: 'Add Card' }).click();
      await expect(ipColumn.locator(`text=${title}`)).toBeVisible();
    }
  });

  test('filters cards by title in real-time', async ({ page }) => {
    await page.getByLabel('Search cards').fill('authentication');
    await page.waitForTimeout(400);

    await expect(page.locator('[aria-label="Card: Bug fix authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Refactor authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Write tests"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Add blue theme"]')).toBeHidden();
  });

  test('displays correct match count', async ({ page }) => {
    await page.getByLabel('Search cards').fill('authentication');
    await page.waitForTimeout(400);

    await expect(page.getByText('2 cards found')).toBeVisible();
  });

  test('shows clear button and clears search', async ({ page }) => {
    await page.getByLabel('Search cards').fill('test');
    await page.waitForTimeout(400);

    await expect(page.getByLabel('Clear search')).toBeVisible();
    await page.getByLabel('Clear search').click();
    await page.waitForTimeout(400);

    // All cards should be visible again
    await expect(page.locator('[aria-label="Card: Bug fix authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Write tests"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Refactor authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Add blue theme"]')).toBeVisible();
  });

  test('clears search with Escape key', async ({ page }) => {
    const searchInput = page.getByLabel('Search cards');
    await searchInput.fill('authentication');
    await page.waitForTimeout(400);

    // Verify filtering is active
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeHidden();

    await searchInput.press('Escape');
    await page.waitForTimeout(400);

    // All cards should be visible again
    await expect(page.locator('[aria-label="Card: Bug fix authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Write tests"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Refactor authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Add blue theme"]')).toBeVisible();
  });

  test('focuses search with Ctrl+F', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await expect(page.getByLabel('Search cards')).toBeFocused();
  });

  test('persists search in URL', async ({ page }) => {
    await page.getByLabel('Search cards').fill('authentication');
    await page.waitForTimeout(400);

    expect(page.url()).toContain('q=authentication');
  });

  test('loads search from URL on page load', async ({ page }) => {
    // Extract boardId from current URL
    const url = page.url();
    const boardId = url.match(/\/boards\/(\d+)/)?.[1];
    expect(boardId).toBeTruthy();

    // Navigate to board with search query
    await page.goto(`/boards/${boardId}?q=authentication`);
    await page.waitForTimeout(400);

    await expect(page.getByLabel('Search cards')).toHaveValue('authentication');
    await expect(page.locator('[aria-label="Card: Bug fix authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Refactor authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeHidden();
  });

  test('shows empty state when no matches', async ({ page }) => {
    await page.getByLabel('Search cards').fill('zzzznonexistent');
    await page.waitForTimeout(400);

    await expect(page.getByText('No matching cards').first()).toBeVisible();
    await expect(page.getByText('0 cards found')).toBeVisible();
  });

  test('case-insensitive search', async ({ page }) => {
    await page.getByLabel('Search cards').fill('AUTHENTICATION');
    await page.waitForTimeout(400);

    await expect(page.locator('[aria-label="Card: Bug fix authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Refactor authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeHidden();
  });

  test('search with partial matches', async ({ page }) => {
    await page.getByLabel('Search cards').fill('auth');
    await page.waitForTimeout(400);

    await expect(page.locator('[aria-label="Card: Bug fix authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Refactor authentication"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature red button"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Write tests"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Add blue theme"]')).toBeHidden();
  });
});
